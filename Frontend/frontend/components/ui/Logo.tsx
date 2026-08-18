import React from 'react'
import Image from 'next/image'

export default function Logo() {
  return (
    <Image src="/nodex.png" alt="Logo Nodex" width={400} height={100} priority/>
  )
}
