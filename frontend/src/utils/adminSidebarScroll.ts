import { useCallback, useLayoutEffect, useRef } from 'react'

let adminSidebarScrollTop = 0

export function useAdminSidebarScroll() {
  const sidebarRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (sidebarRef.current) sidebarRef.current.scrollTop = adminSidebarScrollTop
  }, [])

  const rememberScroll = useCallback(() => {
    if (sidebarRef.current) adminSidebarScrollTop = sidebarRef.current.scrollTop
  }, [])

  const handleScroll = useCallback(() => {
    rememberScroll()
  }, [rememberScroll])

  return { sidebarRef, rememberScroll, handleScroll }
}
