import React, { useState, useRef, useEffect } from 'react';
import styles from './styles.module.less';

interface Message {
  id: string;
  sender: string;
  content: string;
  type: 'me' | 'other' | 'system';
}

export default function WsPlayground() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [roomId, setRoomId] = useState('Room_01');
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const connect = () => {
    if (wsRef.current) wsRef.current.close();

    const socket = new WebSocket(`ws://localhost:3001/ws/game?roomId=${roomId}`);
    
    socket.onopen = () => {
      setConnected(true);
      addMessage('System', '成功连接到 WebSocket 服务器', 'system');
    };

    socket.onmessage = async (event) => {
      let data = event.data;
      let text = '';
      if (data instanceof Blob) {
        text = await data.text();
      } else {
        text = data;
      }

      try {
        const json = JSON.parse(text);
        if (json.event === 'chat') {
          addMessage(json.sender || 'Other', json.message, 'other');
        } else if (json.event === 'system') {
          addMessage('System', json.message, 'system');
        } else {
          addMessage('Other', text, 'other');
        }
      } catch (e) {
        addMessage('Other', text, 'other');
      }
    };

    socket.onclose = () => {
      setConnected(false);
      addMessage('System', '连接已断开', 'system');
    };

    socket.onerror = () => {
      addMessage('System', '连接出错, 请确保 Server 已启动', 'system');
    };

    wsRef.current = socket;
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
  };

  const addMessage = (sender: string, content: string, type: Message['type']) => {
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      sender,
      content,
      type
    }]);
  };

  const sendMessage = () => {
    if (wsRef.current && connected && inputVal) {
      wsRef.current.send(inputVal);
      addMessage('Me', inputVal, 'me');
      setInputVal('');
    }
  };

  return (
    <div className={styles.playground}>
      <div className={styles.playgroundTitle}>
        <span>⚡</span> WebSocket 实时交互演示
      </div>

      <div className={styles.form}>
        <div className={styles.formRow} style={{ display: 'flex', gap: '8px' }}>
          <div className={styles.inputField} style={{ flex: 1 }}>
            <label>房间 ID</label>
            <input 
              value={roomId} 
              onChange={e => setRoomId(e.target.value)} 
              disabled={connected}
            />
          </div>
          <button 
            className={styles.button} 
            onClick={connected ? disconnect : connect}
            style={{ alignSelf: 'flex-end', backgroundColor: connected ? '#f93e3e' : undefined }}
          >
            {connected ? '断开连接' : '进入房间'}
          </button>
        </div>

        <div className={styles.chatWindow}>
          <div className={styles.messages} ref={scrollRef}>
            {messages.length === 0 && (
              <div className={styles.empty}>暂无消息, 点击"进入房间"开始测试</div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`${styles.msgWrapper} ${styles[msg.type]}`}>
                <div className={styles.msgContent}>
                  {msg.type !== 'system' && <span className={styles.sender}>{msg.sender}: </span>}
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.formRow} style={{ display: 'flex', gap: '8px' }}>
          <input 
            placeholder="输入消息内容..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendMessage()}
            disabled={!connected}
          />
          <button 
            className={styles.button}
            onClick={sendMessage}
            disabled={!connected}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
