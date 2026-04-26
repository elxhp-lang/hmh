/**
 * 火山引擎财务API客户端
 * 使用官方 @volcengine/openapi SDK
 * 文档：https://api.volcengine.com/api-docs/view/overview?serviceCode=billing&version=2022-01-01
 */

import { billing } from '@volcengine/openapi';

// ==================== 类型定义 ====================

// API响应基础结构
interface ApiResponse<T = unknown> {
  ResponseMetadata: {
    RequestId: string;
    Action: string;
    Version: string;
    Service: string;
    Region: string;
    Error?: {
      CodeN: number;
      Code: string;
      Message: string;
    };
  };
  Result?: T;
}

// 账单明细项
export interface BillDetailItem {
  BillId: string;
  BillPeriod: string;
  BillDay: string;
  Product: string;
  ProductZh: string;
  ProductCode: string;
  BillingMethod: string;
  BillingMethodZh: string;
  PayMode: string;
  PayModeZh: string;
  BillingItem: string;
  BillingItemZh: string;
  BillingItemCode: string;
  InstanceId: string;
  InstanceName: string;
  Value: number;
  Unit: string;
  ListPrice: number;
  ListPriceUnit: string;
  OffPrice: number;
  OffPriceUnit: string;
  Discount: number;
  RealTotalPrice: number;
  RealTotalPriceUnit: string;
  DeductedByCash: number;
  DeductedByVoucher: number;
  DeductedByCredit: number;
  DeductedByFreeCredit: number;
  OutstandingAmount: number;
  Currency: string;
  OwnerID: string;
  PayerID: string;
  UsageType: string;
  UsageTypeZh: string;
  Zone: string;
  Region: string;
  Tag?: Array<{ Key: string; Value: string }>;
}

// 账单列表结果
export interface BillListResult {
  TotalCount: number;
  PageNum: number;
  PageSize: number;
  Items: BillDetailItem[];
}

// 账单总览项
export interface BillOverviewItem {
  BillPeriod: string;
  Product: string;
  ProductZh: string;
  ProductCode: string;
  BillingMethod: string;
  BillingMethodZh: string;
  PayMode: string;
  PayModeZh: string;
  TotalListPrice: number;
  TotalOffPrice: number;
  TotalRealPrice: number;
  TotalDeductedByCash: number;
  TotalDeductedByVoucher: number;
  TotalDeductedByCredit: number;
  TotalDeductedByFreeCredit: number;
  TotalOutstandingAmount: number;
  Currency: string;
  OwnerID: string;
  PayerID: string;
}

// 账单总览结果
export interface BillOverviewResult {
  TotalCount: number;
  PageNum: number;
  PageSize: number;
  Items: BillOverviewItem[];
}

// 账户余额
export interface BalanceInfo {
  TotalBalance: number;
  TotalReward: number;
  TotalCredit: number;
  TotalFreeCredit: number;
  Currency: string;
  BalanceDetails?: Array<{
    BalanceType: string;
    Balance: number;
    Currency: string;
  }>;
  // 火山引擎实际返回的字段
  AvailableBalance?: string;
  CashBalance?: string;
  CreditLimit?: string;
  FreezeAmount?: string;
  ArrearsBalance?: string;
}

// 订单信息
export interface OrderInfo {
  OrderId: string;
  OrderStatus: string;
  OrderStatusZh: string;
  OrderType: string;
  OrderTypeZh: string;
  OrderCreateTime: string;
  OrderPayTime: string;
  OrderTotalPrice: number;
  OrderRealTotalPrice: number;
  Currency: string;
  ProductInfo?: Array<{
    ProductName: string;
    ProductCode: string;
    InstanceId: string;
    InstanceName: string;
  }>;
}

// 订单列表结果
export interface OrderListResult {
  TotalCount: number;
  PageNum: number;
  PageSize: number;
  Orders: OrderInfo[];
}

// 代金券信息
export interface CouponInfo {
  CouponId: string;
  CouponName: string;
  CouponType: string;
  CouponTypeZh: string;
  FaceValue: number;
  Balance: number;
  Currency: string;
  EffectiveStartTime: string;
  EffectiveEndTime: string;
  Status: string;
  StatusZh: string;
  ApplicableProducts?: string[];
  ApplicableScenarios?: string[];
}

// 代金券列表结果
export interface CouponListResult {
  TotalCount: number;
  PageNum: number;
  PageSize: number;
  Coupons: CouponInfo[];
}

// 资源包信息
export interface ResourcePackage {
  PackageId: string;
  PackageName: string;
  Product: string;
  ProductZh: string;
  PackageType: string;
  PackageTypeZh: string;
  TotalCapacity: number;
  UsedCapacity: number;
  RemainingCapacity: number;
  Unit: string;
  EffectiveStartTime: string;
  EffectiveEndTime: string;
  Status: string;
  StatusZh: string;
}

// 资源包列表结果
export interface ResourcePackageListResult {
  TotalCount: number;
  PageNum: number;
  PageSize: number;
  Packages: ResourcePackage[];
}

// 资源包抵扣明细
export interface PackageUsageDetail {
  PackageId: string;
  PackageName: string;
  DeductTime: string;
  DeductCapacity: number;
  Unit: string;
  InstanceId: string;
  Product: string;
}

// 资源包抵扣明细结果
export interface PackageUsageDetailResult {
  TotalCount: number;
  PageNum: number;
  PageSize: number;
  Details: PackageUsageDetail[];
}

// 预算信息
export interface BudgetInfo {
  BudgetId: string;
  BudgetName: string;
  BudgetType: string;
  BudgetTypeZh: string;
  BillingMode: string;
  BillingModeZh: string;
  BudgetPeriod: string;
  BudgetPeriodZh: string;
  BudgetAmount: number;
  Currency: string;
  AlertThresholds?: number[];
  AlertEmails?: string[];
  Status: string;
  StatusZh: string;
  ActualSpend: number;
  ForecastSpend?: number;
}

// 预算列表结果
export interface BudgetListResult {
  TotalCount: number;
  PageNum: number;
  PageSize: number;
  Budgets: BudgetInfo[];
}

// ==================== 客户端类 ====================

export class VolcengineBillingClient {
  private service: billing.BillingService;
  private initialized: boolean = false;

  constructor(config: { accessKeyId: string; secretKey: string; region?: string }) {
    this.service = new billing.BillingService();
    this.service.setAccessKeyId(config.accessKeyId);
    this.service.setSecretKey(config.secretKey);
    if (config.region) {
      this.service.setRegion(config.region);
    }
    this.initialized = true;
  }

  private async callApi<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const api = this.service.createUrlEncodeAPI(action, {
      method: 'GET',
      Version: '2022-01-01'
    });

    const result = await api(params) as ApiResponse<T>;

    if (result.ResponseMetadata?.Error) {
      throw new Error(
        `API Error [${result.ResponseMetadata.Error.Code}]: ${result.ResponseMetadata.Error.Message}`
      );
    }

    return result.Result as T;
  }

  // ==================== 账单相关API ====================

  /**
   * 分页查询账单明细
   * 文档：https://api.volcengine.com/api-docs/view/?actionName=ListBillDetail
   */
  async listBillDetail(params: {
    BillPeriod?: string;
    BillDay?: string;
    Product?: string;
    BillingMethod?: string;
    PayMode?: string;
    GroupTerm?: string;
    PageNum?: number;
    PageSize?: number;
    Limit?: number;
  } = {}): Promise<BillListResult> {
    return this.callApi<BillListResult>('ListBillDetail', params);
  }

  /**
   * 分页查询账单
   */
  async listBill(params: {
    BillPeriod?: string;
    Product?: string;
    BillingMethod?: string;
    PayMode?: string;
    PageNum?: number;
    PageSize?: number;
  } = {}): Promise<BillListResult> {
    return this.callApi<BillListResult>('ListBill', params);
  }

  /**
   * 分页查询账单总览-产品汇总信息
   */
  async listBillOverviewByProd(params: {
    BillPeriod?: string;
    Product?: string;
    BillingMethod?: string;
    PayMode?: string;
    PageNum?: number;
    PageSize?: number;
    Limit?: number;
  } = {}): Promise<BillOverviewResult> {
    return this.callApi<BillOverviewResult>('ListBillOverviewByProd', params);
  }

  /**
   * 分页查询账单总览-类目汇总信息
   * 返回格式不同，包含 PayableAmount, PaidAmount 等字段
   */
  async listBillOverviewByCategory(params: {
    BillPeriod?: string;
    BillingMethod?: string;
    PayMode?: string;
    PageNum?: number;
    PageSize?: number;
    Limit?: number;
  } = {}): Promise<{
    List: Array<{
      List: Array<{
        PayerID: string;
        PayerUserName: string;
        PayerCustomerName: string;
        BillPeriod: string;
        BillCategoryParent: string;
        OriginalBillAmount: string;
        DiscountBillAmount: string;
        CouponAmount: string;
        PayableAmount: string;
        PaidAmount: string;
        UnpaidAmount: string;
      }>;
    }>;
  }> {
    return this.callApi('ListBillOverviewByCategory', params);
  }

  // ==================== 资金服务API ====================

  /**
   * 查询用户账户余额信息
   * 文档：https://api.volcengine.com/api-docs/view/?actionName=QueryBalanceAcct
   */
  async queryBalanceAcct(): Promise<BalanceInfo> {
    return this.callApi<BalanceInfo>('QueryBalanceAcct');
  }

  // ==================== 订单相关API ====================

  /**
   * 批量查询订单信息
   */
  async listOrders(params: {
    OrderIds?: string[];
    OrderStatus?: string;
    OrderType?: string;
    StartTime?: string;
    EndTime?: string;
    PageNum?: number;
    PageSize?: number;
  } = {}): Promise<OrderListResult> {
    return this.callApi<OrderListResult>('ListOrders', params);
  }

  /**
   * 查询订单详情
   */
  async getOrder(params: { OrderId: string }): Promise<OrderInfo> {
    return this.callApi<OrderInfo>('GetOrder', params);
  }

  /**
   * 取消订单
   */
  async cancelOrder(params: { OrderId: string }): Promise<{ Success: boolean }> {
    return this.callApi<{ Success: boolean }>('CancelOrder', params);
  }

  // ==================== 代金券相关API ====================

  /**
   * 查询代金券信息
   */
  async listCoupons(params: {
    Status?: string;
    EffectiveStartTime?: string;
    EffectiveEndTime?: string;
    PageNum?: number;
    PageSize?: number;
  } = {}): Promise<CouponListResult> {
    return this.callApi<CouponListResult>('ListCoupons', params);
  }

  /**
   * 查询代金券核销记录
   */
  async listCouponUsageRecords(params: {
    CouponId?: string;
    StartTime?: string;
    EndTime?: string;
    PageNum?: number;
    PageSize?: number;
  } = {}): Promise<{
    TotalCount: number;
    PageNum: number;
    PageSize: number;
    Records: Array<{
      CouponId: string;
      CouponName: string;
      DeductAmount: number;
      DeductTime: string;
      OrderId: string;
      Product: string;
    }>;
  }> {
    return this.callApi('ListCouponUsageRecords', params);
  }

  // ==================== 资源包相关API ====================

  /**
   * 查询资源包列表
   */
  async listResourcePackages(params: {
    Status?: string;
    PageNum?: number;
    PageSize?: number;
  } = {}): Promise<ResourcePackageListResult> {
    return this.callApi<ResourcePackageListResult>('ListResourcePackages', params);
  }

  /**
   * 查询资源包抵扣明细列表
   */
  async listPackageUsageDetails(params: {
    PackageId?: string;
    StartTime?: string;
    EndTime?: string;
    PageNum?: number;
    PageSize?: number;
  } = {}): Promise<PackageUsageDetailResult> {
    return this.callApi<PackageUsageDetailResult>('ListPackageUsageDetails', params);
  }

  // ==================== 预算管理API ====================

  /**
   * 查询预算列表
   */
  async listBudget(params: {
    Status?: string;
    PageNum?: number;
    PageSize?: number;
  } = {}): Promise<BudgetListResult> {
    return this.callApi<BudgetListResult>('ListBudget', params);
  }

  /**
   * 查询预算详情
   */
  async queryBudgetDetail(params: { BudgetId: string }): Promise<BudgetInfo> {
    return this.callApi<BudgetInfo>('QueryBudgetDetail', params);
  }

  /**
   * 创建预算
   */
  async createBudget(params: {
    BudgetName: string;
    BudgetType: string;
    BillingMode: string;
    BudgetPeriod: string;
    BudgetAmount: number;
    AlertThresholds?: number[];
    AlertEmails?: string[];
  }): Promise<{ BudgetId: string }> {
    return this.callApi<{ BudgetId: string }>('CreateBudget', params);
  }

  /**
   * 更新预算
   */
  async updateBudget(params: {
    BudgetId: string;
    BudgetName?: string;
    BudgetAmount?: number;
    AlertThresholds?: number[];
    AlertEmails?: string[];
  }): Promise<{ Success: boolean }> {
    return this.callApi<{ Success: boolean }>('UpdateBudget', params);
  }

  /**
   * 删除预算
   */
  async deleteBudget(params: { BudgetId: string }): Promise<{ Success: boolean }> {
    return this.callApi<{ Success: boolean }>('DeleteBudget', params);
  }

  // ==================== 费用分析API ====================

  /**
   * 查询费用分析数据
   */
  async listCostAnalysis(params: {
    StartTime: string;
    EndTime: string;
    Granularity?: string;
    GroupBy?: string[];
    Filter?: Record<string, unknown>;
    PageNum?: number;
    PageSize?: number;
  }): Promise<{
    TotalCount: number;
    Data: Array<{
      Time: string;
      GroupValues: Record<string, string>;
      Amount: number;
      Currency: string;
    }>;
  }> {
    return this.callApi('ListCostAnalysisOpenApi', params);
  }
}

// 导出单例工厂函数（使用环境变量配置）
export function createBillingClient(): VolcengineBillingClient | null {
  const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VOLCENGINE_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    console.warn('Volcengine billing credentials not configured');
    return null;
  }

  return new VolcengineBillingClient({
    accessKeyId,
    secretKey: secretAccessKey,
    region: process.env.VOLCENGINE_REGION || 'cn-north-1'
  });
}
