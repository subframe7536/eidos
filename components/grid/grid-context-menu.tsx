import {
  CompactSelectionRanges
} from "@glideapps/glide-data-grid"
import { useCallback, useMemo } from "react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useCurrentPathInfo } from "@/hooks/use-current-pathinfo"
import { useCurrentSubPage } from "@/hooks/use-current-sub-page"
import { useGoto } from "@/hooks/use-goto"
import { useSqlite } from "@/hooks/use-sqlite"
import { IField } from "@/lib/store/interface"
import { shortenId } from "@/lib/utils"

import { ScriptContextMenu } from "./script-context-menu"
import { useTableAppStore } from "./store"

export function GridContextMenu({
  children,
  handleDelRows,
  getRowByIndex,
  getFieldByIndex,
}: {
  getFieldByIndex: (index: number) => IField
  handleDelRows: (ranges: { startIndex: number; endIndex: number }[]) => void
  getRowByIndex: (index: number) => any
  children: React.ReactNode
}) {
  const { selection, clearSelection } = useTableAppStore()
  const count = useMemo(() => {
    if (selection.current) {
      return selection.current.range.height
    }
    if (selection.rows.length) {
      return selection.rows.length
    }
    return 0
  }, [selection])
  const { space, tableId } = useCurrentPathInfo()
  const { getOrCreateTableSubDoc } = useSqlite(space)
  const { setSubPage } = useCurrentSubPage()

  const goto = useGoto()
  const getRow = useCallback(() => {
    if (!selection.current) {
      return
    }
    const rowIndex = selection.current?.range.y
    const row = getRowByIndex(rowIndex)
    return row
  }, [getRowByIndex, selection])

  const getRows = useCallback(() => {
    if (!selection.current) {
      return
    }
    const { y, height } = selection.current?.range
    const rows = []
    for (let i = y; i < y + height; i++) {
      const row = getRowByIndex(i)
      rows.push(row)
    }
    return rows
  }, [getRowByIndex, selection])

  const getField = useCallback(() => {
    if (!selection.current) {
      return
    }
    const cellIndex = selection.current?.range.x
    const field = getFieldByIndex(cellIndex)
    return field
  }, [getFieldByIndex, selection])

  const getCell = useCallback(() => {
    const row = getRow()
    const field = getField()
    if (!row || !field) return
    const cell = row[field.table_column_name!]
    return cell
  }, [getField, getRow])

  const openRow = async (right?: boolean) => {
    const row = getRow()
    if (!row) return
    const shortId = shortenId(row._id)
    await getOrCreateTableSubDoc({
      docId: shortId,
      title: row.title,
      tableId: tableId!,
    })
    if (right) {
      setSubPage(shortId)
    } else {
      goto(space, shortId)
    }
  }
  const currentField = getField()

  const openURl = () => {
    const cell = getCell()
    if (!cell) return
    window.open(cell, "_blank")
  }
  const handleDelete = () => {
    if (!selection.current) {
      if (selection.rows.length) {
        const items = (selection.rows as any).items as CompactSelectionRanges
        const range = items.map((item) => {
          const [startIndex, endIndex] = item
          return {
            startIndex,
            endIndex,
          }
        })
        handleDelRows(range)
      }
    } else {
      const { y, height } = selection.current?.range
      handleDelRows([
        {
          startIndex: y,
          endIndex: y + height,
        },
      ])
    }
    clearSelection()
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="h-full w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem inset onSelect={() => openRow(true)}>
          Open
        </ContextMenuItem>
        <ContextMenuItem inset onSelect={() => openRow()}>
          Open in full page
        </ContextMenuItem>
        <ContextMenuItem inset onClick={handleDelete}>
          Delete Rows ({count})
        </ContextMenuItem>
        <ContextMenuSeparator />
        {currentField?.type === "url" && (
          <>
            <ContextMenuItem inset onSelect={openURl}>
              Open URL
            </ContextMenuItem>
          </>
        )}
        <ScriptContextMenu getRows={getRows} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
