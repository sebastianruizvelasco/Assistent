import { useState } from 'react'

export function useNotice() {
  const [notice, setNotice] = useState('')
  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 2600)
  }
  return { notice, showNotice }
}
