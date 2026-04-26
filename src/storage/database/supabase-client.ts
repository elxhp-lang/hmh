/**
 * 数据库客户端 - 简化为使用 pg 库 + DATABASE_URL
 * 
 * 支持的环境变量:
 * - DATABASE_URL: 完整的 PostgreSQL 连接字符串（优先）
 * - PGDATABASE_URL: 完整的 PostgreSQL 连接字符串（备用）
 * 
 * 开发环境和生产环境都使用 Coze 平台注入的原生 PostgreSQL
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from 'dotenv';

// 加载 .env.local
let envLoaded = false;

function loadEnv(): void {
  if (envLoaded) return;
  
  try {
    config();
    envLoaded = true;
  } catch {
    // dotenv not available, rely on environment variables
  }
}

// 获取连接池
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) {
    return pool;
  }

  loadEnv();

  const connectionString = process.env.DATABASE_URL || process.env.PGDATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL or PGDATABASE_URL is not set. Please ensure the database is properly configured.');
  }

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected PostgreSQL pool error:', err);
  });

  console.log('[DB] PostgreSQL pool initialized with DATABASE_URL');
  return pool;
}

// 导出 getPool 以便直接使用
export { getPool };

/**
 * Supabase 兼容的响应格式
 */
export interface SupabaseResponse<T> {
  data: T | null;
  error: Error | null;
  count?: number | null;
  status?: number;
  statusText?: string;
}

/**
 * 查询构建器 - 兼容 Supabase SDK 接口
 * 业务代码可以继续使用 supabase.from('table').select().eq('id', 1)
 */
export interface QueryBuilder<T = unknown> {
  select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): QueryBuilder<T>;
  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T>;
  update(data: Partial<T>): QueryBuilder<T>;
  upsert(data: Partial<T> | Partial<T>[]): QueryBuilder<T>;
  delete(): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  neq(column: string, value: unknown): QueryBuilder<T>;
  gt(column: string, value: unknown): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  lt(column: string, value: unknown): QueryBuilder<T>;
  lte(column: string, value: unknown): QueryBuilder<T>;
  like(column: string, pattern: string): QueryBuilder<T>;
  ilike(column: string, pattern: string): QueryBuilder<T>;
  in(column: string, values: unknown[]): QueryBuilder<T>;
  is(column: string, value: unknown): QueryBuilder<T>;
  or(filters: string): QueryBuilder<T>;
  not(column: string, op: string, value: unknown): QueryBuilder<T>;
  textSearch(column: string, query: string): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean; nulls?: 'first' | 'last' }): QueryBuilder<T>;
  range(from: number, to: number): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  offset(count: number): QueryBuilder<T>;
  single(): Promise<SupabaseResponse<T>>;
  maybeSingle(): Promise<SupabaseResponse<T | null>>;
  then<TResult1 = SupabaseResponse<T[]>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResponse<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

interface WhereCondition {
  column: string;
  operator: string;
  value: unknown;
}

interface OrderCondition {
  column: string;
  ascending: boolean;
  nulls?: 'first' | 'last';
}

class QueryBuilderImpl<T extends Record<string, unknown> = Record<string, unknown>> implements QueryBuilder<T> {
  private tableName: string;
  private queryType: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private columns: string[] = [];
  private data: Partial<T> | Partial<T>[] | null = null;
  private whereConditions: WhereCondition[] = [];
  private orConditions: string[] = [];
  private orderConditions: OrderCondition[] = [];
  private limitCount?: number;
  private offsetCount?: number;
  private rangeFrom?: number;
  private rangeTo?: number;

  constructor(table: string) {
    this.tableName = table;
  }

  select(columns?: string, _options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): QueryBuilder<T> {
    // 仅当未设置操作类型时才设为 select（修复：insert/update/upsert/delete 后调用 select 不应覆盖）
    if (!['insert', 'update', 'upsert', 'delete'].includes(this.queryType)) {
      this.queryType = 'select';
    }
    if (columns) {
      this.columns = columns.split(',').map(c => c.trim());
    } else {
      this.columns = [];
    }
    return this;
  }

  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    this.queryType = 'insert';
    this.data = data;
    return this;
  }

  update(data: Partial<T>): QueryBuilder<T> {
    this.queryType = 'update';
    this.data = data;
    return this;
  }

  upsert(data: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    this.queryType = 'upsert';
    this.data = data;
    return this;
  }

  delete(): QueryBuilder<T> {
    this.queryType = 'delete';
    return this;
  }

  eq(column: string, value: unknown): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: '=', value });
    return this;
  }

  neq(column: string, value: unknown): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: '!=', value });
    return this;
  }

  gt(column: string, value: unknown): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: '>', value });
    return this;
  }

  gte(column: string, value: unknown): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: '>=', value });
    return this;
  }

  lt(column: string, value: unknown): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: '<', value });
    return this;
  }

  lte(column: string, value: unknown): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: '<=', value });
    return this;
  }

  like(column: string, pattern: string): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: 'LIKE', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: 'ILIKE', value: pattern });
    return this;
  }

  textSearch(column: string, query: string): QueryBuilder<T> {
    // PostgreSQL 全文搜索使用 @@ 操作符
    // 这里转换为简单的 LIKE 查询作为降级方案
    this.whereConditions.push({ column, operator: 'LIKE', value: `%${query}%` });
    return this;
  }

  in(column: string, values: unknown[]): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: 'IN', value: values });
    return this;
  }

  is(column: string, value: unknown): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: 'IS', value });
    return this;
  }

  or(filters: string): QueryBuilder<T> {
    this.orConditions.push(filters);
    return this;
  }

  not(column: string, op: string, value: unknown): QueryBuilder<T> {
    this.whereConditions.push({ column, operator: `NOT ${op}`, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nulls?: 'first' | 'last' }): QueryBuilder<T> {
    this.orderConditions.push({
      column,
      ascending: options?.ascending !== false,
      nulls: options?.nulls
    });
    return this;
  }

  range(from: number, to: number): QueryBuilder<T> {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this.limitCount = count;
    return this;
  }

  offset(count: number): QueryBuilder<T> {
    this.offsetCount = count;
    return this;
  }

  async single(): Promise<SupabaseResponse<T>> {
    try {
      const results = await this.execute();
      if (results.length === 0) {
        return { data: null, error: new Error('No rows returned') };
      }
      if (results.length > 1) {
        return { data: null, error: new Error('More than one row returned') };
      }
      return { data: results[0] as T, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async maybeSingle(): Promise<SupabaseResponse<T | null>> {
    try {
      const results = await this.execute();
      if (results.length === 0) {
        return { data: null, error: null };
      }
      if (results.length > 1) {
        return { data: null, error: new Error('More than one row returned') };
      }
      return { data: results[0] as T, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  then<TResult1 = SupabaseResponse<T[]>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResponse<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(
      (results) => ({ data: results as T[], error: null, count: results.length }),
      (error) => ({ data: null, error: error as Error, count: 0 })
    ).then(onfulfilled, onrejected);
  }

  private async execute(): Promise<T[]> {
    const pool = getPool();

    switch (this.queryType) {
      case 'select':
        return this.executeSelect(pool);
      case 'insert':
        return this.executeInsert(pool);
      case 'update':
        return this.executeUpdate(pool);
      case 'upsert':
        return this.executeUpsert(pool);
      case 'delete':
        return this.executeDelete(pool);
      default:
        throw new Error(`Unknown query type: ${this.queryType}`);
    }
  }

  private buildWhereClause(additionalParamsOffset: number = 0): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    let paramIndex = 1 + additionalParamsOffset;

    if (this.whereConditions.length === 0) {
      return { sql: '', params: [] };
    }

    const whereParts: string[] = [];
    for (const cond of this.whereConditions) {
      if (cond.operator === 'IN' && Array.isArray(cond.value)) {
        const placeholders = cond.value.map((_, i) => `$${paramIndex + whereParts.length + i}`).join(', ');
        whereParts.push(`"${cond.column}" IN (${placeholders})`);
        params.push(...cond.value);
      } else if (cond.operator === 'IS' && cond.value === null) {
        whereParts.push(`"${cond.column}" IS NULL`);
      } else if (cond.operator === 'IS' && cond.value === 'NOT NULL') {
        whereParts.push(`"${cond.column}" IS NOT NULL`);
      } else {
        whereParts.push(`"${cond.column}" ${cond.operator} $${paramIndex + whereParts.length}`);
        params.push(cond.value);
      }
    }

    return { sql: ` WHERE ${whereParts.join(' AND ')}`, params };
  }

  private async executeSelect(pool: Pool): Promise<T[]> {
    let sql = `SELECT `;
    
    if (this.columns.length > 0) {
      sql += this.columns.map(c => c === '*' ? '*' : `"${c}"`).join(', ');
    } else {
      sql += '*';
    }
    
    sql += ` FROM "${this.tableName}"`;

    const whereResult = this.buildWhereClause(0);
    sql += whereResult.sql;

    if (this.orderConditions.length > 0) {
      const orderParts = this.orderConditions.map(o => {
        let part = `"${o.column}" ${o.ascending ? 'ASC' : 'DESC'}`;
        if (o.nulls) {
          part += ` NULLS ${o.nulls === 'first' ? 'FIRST' : 'LAST'}`;
        }
        return part;
      });
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    if (this.limitCount !== undefined) {
      sql += ` LIMIT ${this.limitCount}`;
    }

    if (this.offsetCount !== undefined) {
      sql += ` OFFSET ${this.offsetCount}`;
    }

    if (this.rangeFrom !== undefined && this.rangeTo !== undefined) {
      sql += ` LIMIT ${this.rangeTo - this.rangeFrom + 1} OFFSET ${this.rangeFrom}`;
    }

    // 注意：SELECT 语句不需要 RETURNING 子句
    const result: QueryResult<T> = await pool.query(sql, whereResult.params);
    return result.rows;
  }

  private async executeInsert(pool: Pool): Promise<T[]> {
    const dataArray = Array.isArray(this.data) ? this.data : [this.data];
    
    if (dataArray.length === 0) {
      return [];
    }

    const firstRow = dataArray[0];
    if (!firstRow) {
      return [];
    }
    
    const columns = Object.keys(firstRow);
    const values: unknown[][] = dataArray.map(row => 
      columns.map(col => (row as Record<string, unknown>)[col])
    );

    const placeholders = values.map((row, rowIndex) => 
      `(${row.map((_, colIndex) => 
        `$${rowIndex * columns.length + colIndex + 1}`
      ).join(', ')})`
    ).join(', ');

    const sql = `
      INSERT INTO "${this.tableName}" (${columns.map(c => `"${c}"`).join(', ')})
      VALUES ${placeholders}
      RETURNING *
    `;

    const flatParams = values.flat();
    const result: QueryResult<T> = await pool.query(sql, flatParams);
    return result.rows;
  }

  private async executeUpdate(pool: Pool): Promise<T[]> {
    const data = this.data;
    if (!data || Object.keys(data as object).length === 0) {
      return [];
    }

    const columns = Object.keys(data as object);
    const setParts = columns.map((col, i) => `"${col}" = $${i + 1}`);
    
    let sql = `UPDATE "${this.tableName}" SET ${setParts.join(', ')}`;

    const whereResult = this.buildWhereClause(columns.length);
    sql += whereResult.sql;

    sql += ' RETURNING *';

    const result: QueryResult<T> = await pool.query(sql, [...Object.values(data), ...whereResult.params]);
    return result.rows;
  }

  private async executeUpsert(pool: Pool): Promise<T[]> {
    const dataArray = Array.isArray(this.data) ? this.data : [this.data];
    
    if (dataArray.length === 0) {
      return [];
    }

    const firstRow = dataArray[0];
    if (!firstRow) {
      return [];
    }
    const columns = Object.keys(firstRow);
    const values: unknown[][] = dataArray.map(row => 
      columns.map(col => (row as Record<string, unknown>)[col])
    );

    const placeholders = values.map((row, rowIndex) => 
      `(${row.map((_, colIndex) => 
        `$${rowIndex * columns.length + colIndex + 1}`
      ).join(', ')})`
    ).join(', ');

    const updateParts = columns.map(col => `"${col}" = EXCLUDED."${col}"`);

    const sql = `
      INSERT INTO "${this.tableName}" (${columns.map(c => `"${c}"`).join(', ')})
      VALUES ${placeholders}
      ON CONFLICT DO UPDATE SET ${updateParts.join(', ')}
      RETURNING *
    `;

    const flatParams = values.flat();
    const result: QueryResult<T> = await pool.query(sql, flatParams);
    return result.rows;
  }

  private async executeDelete(pool: Pool): Promise<T[]> {
    let sql = `DELETE FROM "${this.tableName}"`;

    const whereResult = this.buildWhereClause(0);
    sql += whereResult.sql;

    sql += ' RETURNING *';

    const result: QueryResult<T> = await pool.query(sql, whereResult.params);
    return result.rows;
  }
}

/**
 * Supabase 兼容接口 - 业务代码可以继续使用 supabase.from('users')
 */
export class SupabaseCompatibleClient {
  from<T extends Record<string, unknown> = Record<string, unknown>>(table: string): QueryBuilder<T> {
    return new QueryBuilderImpl<T>(table);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const pool = getPool();
    return pool.query(sql, params);
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 调用 PostgreSQL 函数（RPC）
   * 用于调用 Supabase 数据库函数
   */
  async rpc<T = unknown>(
    fn: string,
    params?: Record<string, unknown>
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const pool = getPool();
      
      // 构建参数
      let sql = `SELECT * FROM ${fn}(`;
      const paramValues: unknown[] = [];
      
      if (params) {
        const keys = Object.keys(params);
        keys.forEach((key, index) => {
          if (index > 0) sql += ', ';
          sql += `$${index + 1}`;
          paramValues.push(params[key]);
        });
      }
      
      sql += ')';
      
      const result = await pool.query(sql, paramValues);
      return { data: result.rows as T, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

// 创建全局实例
const supabase = new SupabaseCompatibleClient();

// 导出 getSupabaseClient 函数以保持兼容
function getSupabaseClient(): SupabaseCompatibleClient {
  return supabase;
}

export { supabase, getSupabaseClient };

// 导出类型
export type { Pool, PoolClient, QueryResult, QueryResultRow };
