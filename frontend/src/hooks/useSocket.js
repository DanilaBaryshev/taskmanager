import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

// базовый URL берём из env, по умолчанию localhost
const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// подключается к серверу, входит в комнату проекта, отключается при размонтировании
export function useSocket(projectId) {
  const socketRef = useRef(null)

  useEffect(() => {
    if (!projectId) return

    const token = localStorage.getItem('token')
    const socket = io(SERVER_URL, { transports: ['websocket'] })
    socketRef.current = socket

    // присоединяемся к комнате проекта после установки соединения
    socket.on('connect', () => {
      socket.emit('join', { projectId, token })
    })

    // при размонтировании отключаемся от сервера
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [projectId])

  return socketRef
}
