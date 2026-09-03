'use client'

import ChampionshipsManager from './ChampionshipsManager'

export default function AdminChampionshipsManager({ embedded = false }: { embedded?: boolean }) {
  return <ChampionshipsManager mode="admin" embedded={embedded} />
}
