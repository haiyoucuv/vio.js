import React, { useState } from 'react';
import axios from 'axios';
import styles from './styles.module.less';

interface ApiPlaygroundProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  defaultData?: any;
  title?: string;
}

export default function ApiPlayground({ method, endpoint, defaultData, title }: ApiPlaygroundProps) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [inputData, setInputData] = useState(defaultData ? JSON.stringify(defaultData, null, 2) : '');
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});

  const handleRequest = async () => {
    setLoading(true);
    setResult(null);

    // Replace placeholders in endpoint like /users/:id
    let finalEndpoint = endpoint;
    Object.entries(urlParams).forEach(([key, value]) => {
      finalEndpoint = finalEndpoint.replace(`:${key}`, value);
    });

    try {
      const config = {
        method,
        url: `http://localhost:3001${finalEndpoint}`,
        data: method !== 'GET' ? JSON.parse(inputData || '{}') : undefined,
        withCredentials: true,
      };
      const res = await axios(config);
      setResult({ status: res.status, data: res.data });
    } catch (err: any) {
      setResult({ 
        status: err.response?.status || 'Error', 
        data: err.response?.data || err.message 
      });
    } finally {
      setLoading(false);
    }
  };

  // Find dynamic parameters in endpoint
  const paramNames = endpoint.split('/').filter(s => s.startsWith(':')).map(s => s.slice(1));

  return (
    <div className={styles.playground}>
      <div className={styles.playgroundTitle}>
        <span>🔥</span> {title || 'API 交互演示'}
      </div>
      
      <div className={styles.form}>
        <div className={styles.endpointBadge}>
          <span className={styles[method.toLowerCase()]}>{method}</span>
          <code>{endpoint}</code>
        </div>

        {paramNames.map(name => (
          <div key={name} className={styles.inputField}>
            <label>参数: {name}</label>
            <input 
              placeholder={`输入 ${name}...`}
              value={urlParams[name] || ''} 
              onChange={e => setUrlParams(prev => ({ ...prev, [name]: e.target.value }))}
            />
          </div>
        ))}

        {method !== 'GET' && (
          <div className={styles.inputField}>
            <label>请求体 (JSON)</label>
            <textarea 
              rows={5}
              value={inputData}
              onChange={e => setInputData(e.target.value)}
            />
          </div>
        )}

        <button 
          className={styles.button}
          onClick={handleRequest} 
          disabled={loading}
        >
          {loading ? '请求中...' : '发送请求'}
        </button>
      </div>

      {result && (
        <div className={`${styles.result} ${result.status >= 400 ? styles.error : styles.success}`}>
          <div className={styles.status}>Status: {result.status}</div>
          <pre>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
