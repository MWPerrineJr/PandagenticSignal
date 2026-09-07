import { Link, useLocation } from 'react-router-dom'
import { LogOutIcon, UserIcon } from 'lucide-react'
import { useAuth } from '@/auth/auth-provider'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function UserMenu() {
  const { status, user, signOut } = useAuth()
  const location = useLocation()
  if (status === 'disabled' || status === 'loading') return null
  if (status === 'signed-out') {
    return (
      <Link
        to="/login"
        state={{ from: location.pathname + location.search }}
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
      >
        <UserIcon /> Sign in
      </Link>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-40 truncate text-xs text-muted-foreground md:inline" title={user?.email ?? ''}>
        {user?.email}
      </span>
      <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}>
        <LogOutIcon />
      </Button>
    </div>
  )
}
