export type ListResponse<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
