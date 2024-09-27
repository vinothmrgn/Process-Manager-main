import path from 'path';
import { app, BrowserWindow, shell, ipcMain, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import kill from 'tree-kill';
import os from 'os';

import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
// eslint-disable-next-line no-undef
const childs: ChildProcessWithoutNullStreams[] = [];

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWs = (win: BrowserWindow) => {
  ipcMain.on('execute-cmd', (e: any, dat: any) => {
    const { pid, cmd, id, name, path, disabled } = dat;

    if (pid !== null) {
      return;
    }
    const child = spawn(cmd, {
      shell: true,
      cwd: path,
    });

    childs.push(child);
    child.stderr.on('data', function (data) {
      win.webContents.send('message', {
        pid: child.pid,
        msg: data.toString(),
        id,
        cmd,
        name,
        path,
        disabled
      });
      console.error('STDERR:', data.toString());
    });
  
    child.stdout.on('data', (data) => {
      win.webContents.send('message', {
        pid: child.pid,
        msg: data.toString(),
        id,
        cmd,
        name,
        path,
        disabled
      });
    });
    child.on('exit', (exitCode) => {
      win.webContents.send('terminal-exited', id);
      setTimeout(() => {
        win.webContents.send('message', {
          pid,
          msg: `Process exited with code: ${exitCode}`,
          id,
          cmd,
          name,
          path,
          disabled: false
        });
      }, 2000);
    });
  });

  ipcMain.on('kill-terminal', async (e: any, message: any) => {
    console.log('terminal kill called');
    console.log(message);
    kill(message.pid, (err)=> {
      // message.pid = null
      // message.disabled = false
      win.webContents.send('message', message);
    });
  });
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('businessman.png'),
    webPreferences: {
      nodeIntegration: true,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  createWs(mainWindow);

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    childs.forEach((ch) => {
      if (ch.pid) kill(ch.pid);
    });
  });
  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    // eslint-disable-next-line no-new
    new Notification();
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
