import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DISCLAIMER_SHORT } from '@/content/disclaimer'

export const ACK_KEY = 'stock-tool.disclaimer-ack'

function readAck(): boolean {
  try {
    return localStorage.getItem(ACK_KEY) === '1'
  } catch {
    return false
  }
}

/** One-time bar asking the visitor to acknowledge the disclosure; remembered in this browser. */
export function AcknowledgementBar() {
  const [acknowledged, setAcknowledged] = useState(readAck)
  if (acknowledged) return null
  const accept = () => {
    try {
      localStorage.setItem(ACK_KEY, '1')
    } catch {
      // private mode: the bar simply returns next visit
    }
    setAcknowledged(true)
  }
  return (
    <div
      role="region"
      aria-label="Disclaimer notice"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
      data-testid="ack-bar"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm">
        <p className="flex-1 min-w-64">
          {DISCLAIMER_SHORT} This site shows data and models for information only.{' '}
          <Link to="/disclaimer" className="underline underline-offset-4">
            Read the disclaimer
          </Link>
          .
        </p>
        <Button size="sm" onClick={accept}>
          I understand
        </Button>
      </div>
    </div>
  )
}
