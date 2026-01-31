"use client"

import * as React from "react"
import type { Table as TableInstance, VisibilityState } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DataTableProps<TData> = {
  table: TableInstance<TData>
  loading?: boolean
  emptyMessage?: string
}

type DataTableToolbarProps<TData> = {
  table: TableInstance<TData>
  searchPlaceholder?: string
  showSearch?: boolean
  showColumnToggle?: boolean
  children?: React.ReactNode
}

type DataTablePaginationProps<TData> = {
  table: TableInstance<TData>
  pageSizeOptions?: number[]
  totalRows?: number
  totalPages?: number
}

export function DataTable<TData>({
  table,
  loading = false,
  emptyMessage = "No results found.",
}: DataTableProps<TData>) {
  const visibleColumns = table.getVisibleLeafColumns()
  const colSpan = Math.max(1, visibleColumns.length)

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = "Search...",
  showSearch = true,
  showColumnToggle = true,
  children,
}: DataTableToolbarProps<TData>) {
  const globalFilter = String(table.getState().globalFilter ?? "")
  const columnVisibility = table.getState().columnVisibility as VisibilityState
  const leftContent = showSearch ? (
    <Input
      placeholder={searchPlaceholder}
      value={globalFilter}
      onChange={(event) => table.setGlobalFilter(event.target.value)}
      className="max-w-sm"
    />
  ) : (
    children ?? <div />
  )
  const rightContent = showSearch ? children : null

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {leftContent}
      <div className="flex flex-wrap items-center gap-2">
        {rightContent}
        {showColumnToggle ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns
                <ChevronDownIcon className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const meta = column.columnDef.meta as { label?: string } | undefined
                  const label =
                    typeof column.columnDef.header === "string"
                      ? column.columnDef.header
                      : meta?.label ?? column.id
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={columnVisibility[column.id] ?? true}
                      onCheckedChange={(checked) =>
                        column.toggleVisibility(Boolean(checked))
                      }
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  )
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [5, 10, 20, 30],
  totalRows,
  totalPages,
}: DataTablePaginationProps<TData>) {
  const resolvedTotalRows =
    typeof totalRows === "number"
      ? totalRows
      : table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const currentPage = pageIndex + 1
  const resolvedTotalPages =
    typeof totalPages === "number"
      ? totalPages
      : Math.max(1, Math.ceil(resolvedTotalRows / pageSize))
  const start = resolvedTotalRows === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min(resolvedTotalRows, (pageIndex + 1) * pageSize)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{start}</span> to{" "}
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{resolvedTotalRows}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={pageSize}
          onChange={(event) => table.setPageSize(Number(event.target.value))}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {resolvedTotalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
