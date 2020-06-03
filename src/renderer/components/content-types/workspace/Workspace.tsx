import React, { useEffect, useContext, useRef } from 'react'
import Debug from 'debug'
import { Handle, Crypto } from 'hypermerge'

import { parseDocumentLink, PushpinUrl, HypermergeUrl, isPushpinUrl } from '../../../ShareLink'
import Content, { ContentProps, ContentHandle } from '../../Content'
import * as ContentTypes from '../../../ContentTypes'
import SelfContext from '../../../SelfHooks'
import TitleBar from './TitleBar'
import { ContactDoc } from '../contact'

import './Workspace.css'
import { useDocument, useCrypto } from '../../../Hooks'
import {
  useAllHeartbeats,
  useHeartbeat,
  useContactOnlineStatus,
  useDeviceOnlineStatus,
} from '../../../PresenceHooks'
import { useSystem } from '../../../System'
import { CurrentDeviceContext } from './Device'

import WorkspaceInList from './WorkspaceInList'

const log = Debug('pushpin:workspace')

export interface Doc {
  selfId: HypermergeUrl
  contactIds: HypermergeUrl[]
  currentDocUrl: PushpinUrl
  viewedDocUrls: PushpinUrl[]
  archivedDocUrls: PushpinUrl[]
  secretKey?: Crypto.SignedMessage<Crypto.EncodedSecretEncryptionKey>
}

interface WorkspaceContentProps extends ContentProps {
  setWorkspaceUrl: (newWorkspaceUrl: PushpinUrl) => void
  createWorkspace: () => void
}

interface ClipperPayload {
  src: string
  dataUrl: string
  capturedAt: string
}

export default function Workspace(props: WorkspaceContentProps) {
  const crypto = useCrypto()
  const [workspace, changeWorkspace] = useDocument<Doc>(props.hypermergeUrl)
  const currentDeviceUrl = useContext(CurrentDeviceContext)

  const selfId = workspace && workspace.selfId
  const currentDocUrl =
    workspace && workspace.currentDocUrl && parseDocumentLink(workspace.currentDocUrl).hypermergeUrl

  const [self, changeSelf] = useDocument<ContactDoc>(selfId)
  const currentDeviceId = currentDeviceUrl
    ? parseDocumentLink(currentDeviceUrl).hypermergeUrl
    : null

  useAllHeartbeats(selfId)
  useHeartbeat(selfId)
  useHeartbeat(currentDeviceId)
  useHeartbeat(currentDocUrl)

  useDeviceOnlineStatus(currentDeviceId)
  useContactOnlineStatus(selfId)

  const sendToSystem = useSystem(
    (msg) => {
      switch (msg.type) {
        case 'IncomingUrl':
          openDoc(msg.url)
          break
        case 'NewDocument':
          if (!selfId) break
          ContentTypes.create('board', { selfId }, (boardUrl: PushpinUrl) => {
            openDoc(boardUrl)
          })
          break
        case 'NewWorkspace':
          props.createWorkspace()
          break
      }
    },
    [selfId]
  )

  useEffect(() => {
    // For background debugging:
    if (currentDocUrl) sendToSystem({ type: 'Navigated', url: currentDocUrl })
  }, [currentDocUrl, sendToSystem])

  // Add devices if not already on doc.
  useEffect(() => {
    if (!currentDeviceUrl || !self) {
      return
    }

    const { hypermergeUrl } = parseDocumentLink(currentDeviceUrl)
    if (!self.devices || !self.devices.includes(hypermergeUrl)) {
      changeSelf((doc: ContactDoc) => {
        if (!doc.devices) {
          doc.devices = []
        }
        doc.devices.push(hypermergeUrl)
      })
    }
  }, [changeSelf, currentDeviceUrl, self])

  // Add encryption keys if not already on doc.
  useEffect(() => {
    if (!workspace || !selfId || workspace.secretKey) return

    try {
      migrateEncryptionKeys()
    } catch {
      console.log(
        'Unable to set encryption keys on workspace. Must be on the device which created the workspace.'
      )
    }

    async function migrateEncryptionKeys() {
      if (!workspace || !selfId || workspace.secretKey) return
      const encryptionKeyPair = await crypto.encryptionKeyPair()
      const signedPublicKey = await crypto.sign(selfId, encryptionKeyPair.publicKey)
      const signedSecretKey = await crypto.sign(props.hypermergeUrl, encryptionKeyPair.secretKey)
      changeSelf((doc: ContactDoc) => {
        doc.encryptionKey = signedPublicKey
      })
      changeWorkspace((doc: Doc) => {
        doc.secretKey = signedSecretKey
      })
    }
  }, [workspace, selfId, workspace && workspace.secretKey])

  function openDoc(docUrl: string) {
    if (!isPushpinUrl(docUrl)) {
      return
    }

    const { type } = parseDocumentLink(docUrl)
    if (type === 'workspace') {
      // we're going to have to deal with this specially...
      props.setWorkspaceUrl(docUrl)
      return
    }

    if (!workspace) {
      log('Trying to navigate to a document before the workspace doc is loaded!')
      return
    }

    // Reset scroll position
    window.scrollTo(0, 0)

    changeWorkspace((ws: Doc) => {
      ws.currentDocUrl = docUrl

      ws.viewedDocUrls = ws.viewedDocUrls.filter((url) => url !== docUrl)
      ws.viewedDocUrls.unshift(docUrl)

      if (ws.archivedDocUrls) {
        ws.archivedDocUrls = ws.archivedDocUrls.filter((url) => url !== docUrl)
      }
    })
  }
  const contentRef = useRef<ContentHandle>(null)

  function onContent(url: PushpinUrl) {
    if (contentRef.current) {
      return contentRef.current.onContent(url)
    }
    return false
  }

  log('render')
  if (!workspace) {
    return null
  }

  function renderContent(currentDocUrl?: PushpinUrl) {
    if (!currentDocUrl) {
      return null
    }

    const { type } = parseDocumentLink(currentDocUrl)
    return (
      <div className={`Workspace__container Workspace__container--${type}`}>
        <Content ref={contentRef} context="workspace" url={currentDocUrl} />
      </div>
    )
  }

  const content = renderContent(workspace.currentDocUrl)

  return (
    <SelfContext.Provider value={workspace.selfId}>
      <div className="Workspace">
        <TitleBar hypermergeUrl={props.hypermergeUrl} openDoc={openDoc} onContent={onContent} />
        {content}
      </div>
    </SelfContext.Provider>
  )
}

function create(_attrs: any, handle: Handle<Doc>) {
  ContentTypes.create('contact', {}, (selfContentUrl) => {
    const selfHypermergeUrl = parseDocumentLink(selfContentUrl).hypermergeUrl
    // this is, uh, a nasty hack.
    // we should refactor not to require the hypermergeUrl on the contact
    // but i don't want to pull that in scope right now

    ContentTypes.create('text', { title: 'A Text Box', selfId: selfHypermergeUrl }, (boardUrl) => {
      handle.change((workspace) => {
        workspace.selfId = selfHypermergeUrl
        workspace.contactIds = []
        workspace.currentDocUrl = boardUrl
        workspace.viewedDocUrls = [boardUrl]
      })
    })
  })
}

ContentTypes.register({
  type: 'workspace',
  name: 'Workspace',
  icon: 'briefcase',
  contexts: {
    root: Workspace,
    list: WorkspaceInList,
    board: WorkspaceInList,
    'title-bar': WorkspaceInList,
  },
  resizable: false,
  unlisted: true,
  create,
})
