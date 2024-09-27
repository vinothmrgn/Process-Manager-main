import Accordion from '@mui/material/Accordion';
import AccordionActions from '@mui/material/AccordionActions';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import RemoveIcon from '@mui/icons-material/DeleteOutline';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { IndexableType } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import React, { useState, useEffect } from 'react';
import _ from 'lodash';
import { db } from './db';
import './App.css';

//
interface TerminalMsgs {
  cmd: string;
  pid: number | null;
  msg: string;
  id?: IndexableType;
  name: string;
  path: string;
  disabled: boolean;
}

interface TerminalMsgProp {
  id: number;
  msg: [];
  expanded: boolean;
}

function Hello() {
  const [cmdInput, setCmdInput] = useState({
    name: '',
    cmd: '',
    path: '',
  });
  const [errors, setErrors] = useState({
    name: '',
    cmd: '',
    path: '',
  });
  const [touched, setTouched] = useState({
    name: false,
    cmd: false,
    path: false,
  });
  const [msgs, setMsgs] = useState<TerminalMsgProp[]>([]);
  const [alertMsg, setAlertMsg] = React.useState('');

  const allItems = useLiveQuery(() => db.terminal?.toArray(), []);

  useEffect(() => {
    db.terminal.toArray().then((arr) =>
      arr.forEach((it) => {
        if (it.id) {
          db.terminal.update(it.id, {
            pid: null,
            disabled: false,
          });
        }
      }),
    );
    const socketInitializer = async () => {
      window.electron.ipcRenderer.on('message', async (data: any) => {
        if (!data || !data.id) {
          return;
        }
        setMsgs((prev) => {
          const prevMsg = _.get(prev, data?.id)?.msg || [];

          let updatedMsg = [...prevMsg, data.msg];

          if (updatedMsg.length > 200) {
            updatedMsg = updatedMsg.slice(
              updatedMsg.length - 199,
              updatedMsg.length,
            );
          }
          return [
            ..._.set(msgs, data?.id, {
              id: data?.id,
              msg: updatedMsg,
            }),
          ];
        });
        await db.terminal.update(data.id, {
          pid: data.pid,
          msg: data.msg,
          disabled: data.disabled,
        });
      });
    };
    socketInitializer();
  }, []);

  const validator = (name: string, val: string) => {
    let err = '';
    if (_.isEmpty(val)) {
      err = 'Should not be empty';
    }
    setErrors((prev) => {
      return {
        ...prev,
        [name]: err,
      };
    });
    return err;
  };

  const onChangeHandler = (e: any) => {
    setCmdInput((prev) => {
      return {
        ...prev,
        [e.target.name]: e.target.value,
      };
    });
    validator(e.target.name, e.target.value);
  };

  const handleBlur = (e: any) => {
    setTouched((prev) => {
      return {
        ...prev,
        [e.target.name]: true,
      };
    });
    validator(e.target.name, e.target.value);
  };

  const handleExecute = (m: TerminalMsgs) => {
    if (m.id) {
      db.terminal.update(m.id, {
        msg: '',
        disabled: true,
      });
      setMsgs((prev) => {
        const prevMsg: TerminalMsgProp[] =
          _.get(prev, m?.id as string)?.msg || [];

        let updatedMsg = prevMsg.length ? [...prevMsg, '\n\n'] : prevMsg;
        return [
          ..._.set(msgs, m?.id as string, {
            id: m?.id,
            msg: updatedMsg,
          }),
        ];
      });
    }

    m.disabled = true;
    console.log(m);

    window.electron.ipcRenderer.sendMessage('execute-cmd', m);
  };
  const handleKill = (m: TerminalMsgs) => {
    window.electron.ipcRenderer.sendMessage('kill-terminal', m);
  };

  const handleAdd = async () => {
    setTouched({
      name: true,
      path: true,
      cmd: true,
    });
    const validatedErrors = _.map(cmdInput, (val, key) => validator(key, val));
    const isError = _.some(validatedErrors, (a) => !_.isEmpty(a));
    if (isError) {
      setAlertMsg('Fill all the fields');
      return;
    }
    const addTerm = {
      pid: null,
      msg: '',
      cmd: cmdInput.cmd,
      name: cmdInput.name,
      path: cmdInput.path,
      disabled: false,
    };
    await db.terminal.put(addTerm);
    setCmdInput({
      name: '',
      path: '',
      cmd: '',
    });
    setErrors({
      name: '',
      path: '',
      cmd: '',
    });
  };

  const handleDelete = async (m: TerminalMsgs) => {
    if (!m.id) {
      return;
    }
    if (m.pid) {
      setAlertMsg('Process will be terminated');
      handleKill(m);
    }
    await db.terminal.delete(m.id);
  };

  const handleClose = (
    event?: React.SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === 'clickaway') {
      return;
    }

    setAlertMsg('');
  };

  return (
    <div>
      <CardContent className="card-content">
        <TextField
          id="name"
          name="name"
          label="Name"
          variant="outlined"
          value={cmdInput.name}
          onChange={(e) => onChangeHandler(e)}
          onBlur={handleBlur}
          className="h-12"
          // error={touched.name && !_.isEmpty(errors.name)}
        />
        <TextField
          id="path"
          name="path"
          label="Path"
          variant="outlined"
          value={cmdInput.path}
          onChange={(e) => onChangeHandler(e)}
          onBlur={handleBlur}
          className="h-12"
          // error={touched.path && !_.isEmpty(errors.path)}
        />
        <TextField
          id="cmd"
          name="cmd"
          label="Command"
          variant="outlined"
          value={cmdInput.cmd}
          onChange={(e) => onChangeHandler(e)}
          onBlur={handleBlur}
          className="h-12"
          // error={touched.cmd && !_.isEmpty(errors.cmd)}
        />
        <Button onClick={handleAdd} className="h-14">
          Add
        </Button>
      </CardContent>
      <CardActions />
      <Divider />
      {allItems?.map((m, i) => {
        return (
          <Accordion key={i} classes={{ expanded: 'margin0' }}>
            <div className={`accord-summary-wrapper ${m.pid ? 'running' : ''}`}>
              <RemoveIcon
                style={{ cursor: 'pointer' }}
                onClick={() => handleDelete(m)}
              />
              <AccordionSummary
                aria-controls="panel3-content"
                id="panel3-header"
                classes={{
                  root: 'accord-summary',
                  content: 'summary-content',
                  expanded: 'summary-exp',
                }}
              >
                <p className="">{m.name || m.cmd}</p>
                {m.pid && <p className="pid">pid : {m.pid}</p>}
              </AccordionSummary>
              <AccordionActions>
                <Button
                  sx={{
                    pointerEvents: 'auto',
                  }}
                  disabled={m.disabled}
                  onClick={() => handleExecute(m)}
                >
                  Run
                </Button>
                <Button
                  sx={{
                    pointerEvents: 'auto',
                  }}
                  disabled={!m.disabled}
                  onClick={() => handleKill(m)}
                >
                  Kill
                </Button>
              </AccordionActions>
            </div>
            <AccordionDetails classes={{ root: 'terminal-window' }}>
              <pre className="">
                {msgs?.find((ms) => ms?.id === m?.id)?.msg || ''}
              </pre>
            </AccordionDetails>
          </Accordion>
        );
      })}
      <Snackbar open={!!alertMsg} autoHideDuration={6000} onClose={handleClose}>
        <Alert onClose={handleClose} severity="warning" sx={{ width: '100%' }}>
          {alertMsg}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default function App() {
  return <Hello />;
}
