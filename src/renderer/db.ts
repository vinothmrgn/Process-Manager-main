/* eslint-disable prettier/prettier */
import Dexie, { IndexableType, Table } from "dexie";


interface Terminal {
    cmd: string;
    pid: number | null;
    msg: string;
    id?: IndexableType;
    name: string;
    path: string;
    disabled: boolean;
  }

export class MySubClassedDexie extends Dexie {
    // 'friends' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    terminal!: Table<Terminal>;
  
    constructor() {
      super('myDatabase');
      this.version(1).stores({
        terminal: '++id, cmd, pid, msg, name, path, disabled' // Primary key and indexed props
      });
    }
  }

  
export const db = new MySubClassedDexie();