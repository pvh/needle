import { app, protocol, BrowserWindow, Menu, shell, MenuItemConstructorOptions } from 'electron'
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer'
import Debug from 'debug'
import * as Hyperfile from '../renderer/hyperfile'
import { FromSystemMsg } from '../renderer/System'

const log = Debug('pushpin:electron')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null = null
let backgroundWindow: BrowserWindow | null = null
const isDevelopment = process.env.NODE_ENV !== 'production'
let isQuitting = false

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  installExtension(REACT_DEVELOPER_TOOLS)
  registerProtocolHandlers()
  createMenu()
  createWindow()
})

app.once('will-quit', () => {
  isQuitting = true
})

protocol.registerSchemesAsPrivileged([
  { scheme: 'hypermerge', privileges: { standard: false, bypassCSP: true } },
  {
    scheme: 'hyperfile',
    privileges: {
      bypassCSP: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      secure: true,
      corsEnabled: true,
    },
  },
])

async function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      webviewTag: true,
    },
  })

  createBackgroundWindow()

  if (isDevelopment) {
    mainWindow.webContents.openDevTools()
    mainWindow.loadURL(`http://localhost:8080`)
  } else {
    mainWindow.loadFile('dist/index.html')
  }

  mainWindow.once('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow && mainWindow.focus()
    setImmediate(() => {
      mainWindow && mainWindow.focus()
    })
  })

  mainWindow.webContents.on('devtools-reload-page', () => {
    backgroundWindow && backgroundWindow.reload()
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // we only allow pushpin links to navigate
    // to avoid ever being in a position where we're loading rando files
    // or URLs within the app and getting stranded there
    if (isDevelopment && url.startsWith(`http://localhost:8080`)) {
      return
    }

    if (!url.match('pushpinContentType')) {
      event.preventDefault()
    }
    if (isSafeishURL(url)) {
      shell.openExternal(url)
    }
  })

  mainWindow.webContents.on('new-window', (event, url) => {
    // we only allow pushpin links to navigate
    // to avoid ever being in a position where we're loading rando files
    // or URLs within the app and getting stranded there
    // NB: i don't think we actually use new-window pushpin links, but
    //     this will hopefully guard it if for some reason we do in the future
    if (!url.match('pushpinContentType')) {
      event.preventDefault()
    }
    if (isSafeishURL(url)) {
      shell.openExternal(url)
    }
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

function createBackgroundWindow() {
  if (backgroundWindow) {
    // Ensure that we wait for the 'closed' event before continuing:
    backgroundWindow.once('closed', () => {
      createBackgroundWindow()
    })
    backgroundWindow.close()
    return
  }

  // Create the browser window.
  backgroundWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    show: false,
    webPreferences: {
      nodeIntegration: true,
    },
  })
  const isDevelopment = process.env.NODE_ENV !== 'production'

  if (isDevelopment) {
    backgroundWindow.loadURL(`http://localhost:8080/background.html`)
  } else {
    backgroundWindow.loadFile('dist/background.html')
  }

  backgroundWindow.on('close', (e) => {
    if (!backgroundWindow) return
    if (isQuitting) return

    if (mainWindow && backgroundWindow.isVisible()) {
      e.preventDefault()
      backgroundWindow.hide()
    }
  })

  backgroundWindow.once('closed', () => {
    backgroundWindow = null
  })
}

function createMenu() {
  const isMac = process.platform === 'darwin'
  // Menubar template
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Board...',
          accelerator: 'CmdOrCtrl+N',
          click: (_item, _focusedWindow) => {
            sendSystemMsg({ type: 'NewDocument' })
          },
        },
        {
          label: 'New Workspace...',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: (_item, _focusedWindow) => {
            sendSystemMsg({ type: 'NewWorkspace' })
          },
        },
        ...(isMac
          ? []
          : [
              {
                label: 'Exit',
                accelerator: 'Ctrl+Q',
                click: () => {
                  app.exit(0)
                },
              },
            ]),
      ],
    },

    {
      label: 'Edit',
      submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }],
    },
    {
      label: 'Develop',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: (_item, _focusedWindow) => {
            mainWindow && mainWindow.reload()
            backgroundWindow && backgroundWindow.reload()
          },
        },
        {
          label: 'Relaunch App',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (_item, _focusedWindow) => {
            app.relaunch()
            app.exit(0)
          },
        },
        {
          label: 'Toggle Background Window',
          accelerator: 'CmdOrCtrl+Option+B',
          click: (_item, _focusedWindow) => {
            backgroundWindow && toggleWindow(backgroundWindow)
          },
        },
        {
          label: 'Open Inspector',
          accelerator: 'CmdOrCtrl+Option+I',
          click: (_item, focusedWindow) => {
            focusedWindow.webContents.toggleDevTools()
          },
        },
      ],
    },
  ]

  // macOS requires first menu item be name of the app
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [{ role: 'about' }, { role: 'quit' }],
    })
  }

  // Create the menubar
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function registerProtocolHandlers() {
  protocol.registerStringProtocol('hypermerge', (req, _cb) => {
    // we don't want to use loadURL because we don't want to reset the whole app state
    // so we use the workspace manipulation function here
    sendSystemMsg({ type: 'IncomingUrl', url: req.url })
  })

  // TODO: convert to a stream protocol once we support content range the
  // hypermerge FileServer
  protocol.registerBufferProtocol(
    'hyperfile',
    async (request, callback) => {
      try {
        if (Hyperfile.isHyperfileUrl(request.url)) {
          const [{ mimeType }, stream] = await Hyperfile.fetch(request.url)
          const data = await Hyperfile.streamToBuffer(stream)
          callback({ mimeType, data })
        }
      } catch (e) {
        log(e)
      }
    },
    (error) => {
      if (error) {
        log('Failed to register protocol')
      }
    }
  )
}

function sendSystemMsg(msg: FromSystemMsg): void {
  mainWindow && mainWindow.webContents.send('system.msg', msg)
}

function toggleWindow(win: BrowserWindow): boolean {
  if (win.isVisible()) {
    win.hide()
    return false
  }

  win.show()
  return true
}

function isSafeishURL(url: string) {
  return url.startsWith('http:') || url.startsWith('https:')
}
