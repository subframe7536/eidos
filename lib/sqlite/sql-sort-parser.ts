import {
  ExprRef,
  OrderByStatement,
  SelectFromStatement,
  astMapper,
  astVisitor,
  parse,
  parseFirst,
  toSql,
} from "pgsql-ast-parser"

import { OrderByItem } from "@/components/table/view-sort-editor"

import { IField } from "../store/interface"

export const getSortColumns = (query: string) => {
  const ast = parseFirst(query) as SelectFromStatement
  return ast.orderBy?.map((o) => {
    return (o.by as ExprRef).name
  })
}

/**
 * before call this function, the query sql must be transformed by transformQueryWithFormulaFields2Sql.
 * because orderBy may be included formula fields
 * @param query
 * @returns
 */
export const rewriteQuery2getSortedRowIds = (
  query: string,
  useTempTable?: boolean
) => {
  const ast = parseFirst(query) as SelectFromStatement
  const mapper = astMapper((map) => ({
    ref: (t) => {
      // we need to rewrite the query to get sorted row IDs, replacing * with _id to reduce the data size
      if (t.name === "*") {
        return {
          ...t,
          name: "_id",
        }
      }
      return map.super().ref(t)
    },
  }))
  if (!useTempTable && !ast.orderBy) {
    ast.orderBy = [
      {
        by: {
          type: "ref",
          name: "_id",
        },
        order: "ASC",
      },
    ]
  }
  const modified = mapper.statement(ast) as SelectFromStatement

  return toSql.statement(modified)
}

export const rewriteQuery2getSortedSqliteRowIds = (query: string) => {
  const ast = parseFirst(query) as SelectFromStatement
  const mapper = astMapper((map) => ({
    ref: (t) => {
      // we need to rewrite the query to get sorted row IDs, replacing * with _id to reduce the data size
      if (t.name === "*") {
        return {
          ...t,
          name: "_id",
        }
      }
      return map.super().ref(t)
    },
  }))
  if (!ast.orderBy) {
    ast.orderBy = [
      {
        by: {
          type: "ref",
          name: "_id",
        },
        order: "ASC",
      },
    ]
  }
  const modified = mapper.statement(ast) as SelectFromStatement

  return toSql.statement(modified)
}

export const rewriteQueryWithOffsetAndLimit = (
  query: string,
  offset: number,
  limit: number
) => {
  const ast = parseFirst(query) as SelectFromStatement
  // add rowid to select list
  ast.columns?.push({
    expr: {
      type: "ref",
      name: "_id",
    },
  })

  if (!ast.orderBy) {
    ast.orderBy = [
      {
        by: {
          type: "ref",
          name: "_id",
        },
        order: "ASC",
      },
    ]
  }
  return toSql.statement(ast) + ` LIMIT ${limit} OFFSET ${offset}`
}

export const hasOrderBy = (query?: string) => {
  if (!query) return false
  const ast = parseFirst(query)
  const selectStatement = ast as SelectFromStatement
  return selectStatement.orderBy !== undefined
}

export const transformQueryWithOrderBy2Sql = (
  orderBy: OrderByItem[],
  query: string,
  fieldMap: { [fieldId: string]: IField<any> }
) => {
  const parsedSql = parseFirst(query) as SelectFromStatement
  if (!orderBy.length) {
    delete parsedSql.orderBy
  } else {
    const newOrderBy = orderBy.map((item) => {
      const columnId = item.column
      const field = fieldMap[columnId]
      const isNumber = field?.type === "number"
      console.log(`field`, field, fieldMap, isNumber)
      return {
        by: isNumber
          ? {
              type: "cast",
              operand: {
                type: "ref",
                name: item.column as any,
              },
              to: {
                name: "real",
              },
            }
          : {
              type: "ref",
              name: item.column as any,
            },
        order: item.order as any,
      } as OrderByStatement
    })
    parsedSql.orderBy = newOrderBy
  }

  const newSql = toSql.statement(parsedSql)
  // fix cast for sqlite  (number_field::real ) => cast(number_field as real)
  // we just use regex to replace the cast
  const castReg = /\((.*)(::)(.*)\)/g
  const newSqlWithCast = newSql.replace(castReg, "CAST($1 as $3)")
  return newSqlWithCast
}
