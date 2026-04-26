# 火山引擎财务 API 完整参数文档

> 最后更新：2026-04-17
> 来源：https://www.volcengine.com/docs/6269/1165275

---

## 一、API 概览

### 1.1 账单管理（限流：单账号 5 QPS）

| API名称 | 说明 |
|---------|------|
| [ListBillOverviewByCategory](#二listbilloverviewbycategory-查询账单总览-账号汇总) | 查询账单总览-账号汇总信息 |
| [ListBillOverviewByProd](#三listbilloverviewbyprod-账单总览-产品汇总) | 分页查询账单总览-产品汇总信息 |
| [ListBill](#四listbill-分页查询账单) | 分页查询账单 |
| [ListBillDetail](#五listbilldetail-分页查询账单明细) | 分页查询账单明细 |
| [ListSplitBillDetail](#六listsplitbilldetail-分账账单) | 分页查询分账账单 |
| [ListAmortizedCostBillMonthly](#七listamortizedcostbillmonthly-成本账单总览) | 分页查询成本账单总览 |
| [ListAmortizedCostBillDetail](#八listamortizedcostbilldetail-成本账单明细) | 分页查询成本账单明细 |
| [ListAmortizedCostBillDaily](#九listamortizedcostbilldaily-成本账单按天) | 分页查询成本账单按天 |

### 1.2 资金账户

| API | 说明 |
|-----|------|
| [QueryBalanceAcct](#十querybalanceacct-账户余额查询) | 查询账户余额 |

---

## 二、ListBillOverviewByCategory - 查询账单总览-账号汇总

**文档**：https://www.volcengine.com/docs/6269/1166591

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| BillPeriod | String | **是** | 账务账期：YYYY-MM，最多24个月 |
| BillingMode | String[] | 否 | 计费模式：1包年包月，2按量计费，3合同计费，4履约计费 |
| BillCategoryParent | String[] | 否 | 账单大类：consume消费，refund退款，transfer调账 |
| PayerID | Long[] | 否 | Payer账号ID |
| OwnerID | Long[] | 否 | Owner账号ID |

### 返回参数

| 参数 | 类型 | 描述 |
|------|------|------|
| List | Array | 账单列表 |
| OwnerID | String | Owner账号ID |
| PayerID | String | Payer账号ID |
| PayableAmount | String | 应付金额 |
| UnpaidAmount | String | 欠费金额 |
| OriginalBillAmount | String | 原价 |
| DiscountBillAmount | String | 折后价 |
| PaidAmount | String | 现金支付 |
| CouponAmount | String | 代金券抵扣 |
| Currency | String | 币种 |
| SettlementType | String | 结算类型：settle结算，non-settle非结算，quota-settle |

---

## 三、ListBillOverviewByProd - 账单总览-产品汇总

**文档**：https://www.volcengine.com/docs/6269/1127843

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| BillPeriod | String | **是** | 账期：YYYY-MM，最多24个月 |
| Limit | Integer | **是** | 数量：[1-300] |
| Offset | Integer | 否 | 偏移量 |
| PayerID | Long[] | 否 | Payer账号ID |
| OwnerID | Long[] | 否 | Owner账号ID |
| IgnoreZero | Integer | 否 | 是否忽略折后价为0：0否，1是 |
| NeedRecordNum | Integer | 否 | 是否需要总数：1需要，0不需要 |
| BillingMode | String[] | 否 | 计费模式 |
| BillCategoryParent | String[] | 否 | 账单大类 |
| Product | String[] | 否 | 产品名称 |

### 返回参数

```json
{
  "BillPeriod": "2022-10",
  "Product": "on_line",
  "ProductZh": "线上测试产品",
  "BillingMode": "2",
  "OriginalBillAmount": "158452.248288",
  "DiscountBillAmount": "158449.68",
  "CouponAmount": "0.00",
  "PayableAmount": "0.00",
  "Currency": "CNY"
}
```

---

## 四、ListBill - 分页查询账单

**文档**：https://www.volcengine.com/docs/6269/1127841

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| BillPeriod | String | **是** | 账期：YYYY-MM，最多24个月 |
| Limit | Integer | **是** | 数量：[1-300] |
| Offset | Integer | 否 | 偏移量 |
| BillCategoryParent | String[] | 否 | 账单大类：consume/refund/transfer |
| BillingMode | String[] | 否 | 计费模式：1-4 |
| Product | String[] | 否 | 产品名称 |
| PayerID | Long[] | 否 | Payer账号ID |
| OwnerID | Long[] | 否 | Owner账号ID |
| PayStatus | String | 否 | 支付状态：CompletedSettle已结清，PartSettle未结清，Unsettle未结算 |
| IgnoreZero | Integer | 否 | 是否忽略折后价为0 |
| NeedRecordNum | Integer | 否 | 是否需要总数 |

### 返回参数

```json
{
  "List": [{
    "BillPeriod": "2022-10",
    "PayerID": "2000010593",
    "Product": "on_line",
    "ProductZh": "线上测试产品",
    "BillingMode": "2",
    "BillCategoryParent": "消费",
    "OriginalBillAmount": "212.973452",
    "DiscountBillAmount": "212.97",
    "CouponAmount": "0.00",
    "PayableAmount": "0.00",
    "Currency": "CNY",
    "PayStatus": "已结清"
  }],
  "Total": 744,
  "Limit": 10,
  "Offset": 0
}
```

---

## 五、ListBillDetail - 分页查询账单明细

**文档**：https://www.volcengine.com/docs/6269/1127842

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| BillPeriod | String | **是** | 账期：YYYY-MM |
| Limit | Integer | **是** | 数量：[1-300] |
| Offset | Integer | 否 | 偏移量 |
| GroupTerm | String | **是** | 分组维度：BillDay按天，Product按产品，BillingItem按计费项 |
| PayerID | Long[] | 否 | Payer账号ID |
| OwnerID | Long[] | 否 | Owner账号ID |
| BillingMode | String[] | 否 | 计费模式 |
| BillCategoryParent | String[] | 否 | 账单大类 |
| Product | String[] | 否 | 产品名称 |
| IgnoreZero | Integer | 否 | 是否忽略折后价为0 |
| NeedRecordNum | Integer | 否 | 是否需要总数 |

---

## 六、ListSplitBillDetail - 分账账单

**文档**：https://www.volcengine.com/docs/6269/1127494

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| BillPeriod | String | **是** | 账期：YYYY-MM |
| Limit | Integer | **是** | 数量：[1-300] |
| Offset | Integer | 否 | 偏移量 |
| Product | String[] | 否 | 产品名称 |
| BillingMode | String[] | 否 | 计费模式：1包年包月，2按量计费，3合同计费，4履约计费 |
| BillCategory | String[] | 否 | 账单类型 |
| ExpenseDate | String | 否 | 账单日期：YYYY-MM-DD，提升查询性能 |
| PayerID | Long[] | 否 | Payer账号ID |
| OwnerID | Long[] | 否 | Owner账号ID |
| GroupPeriod | Integer | 否 | 统计周期：0账期，1按天，2明细 |
| InstanceNo | String | 否 | 实例ID |
| SplitItemID | String | 否 | 分拆项ID |
| IgnoreZero | Integer | 否 | 是否忽略折后价为0 |
| NeedRecordNum | Integer | 否 | 是否需要总数 |

### BillCategory 账单类型枚举

| 值 | 说明 |
|----|------|
| consume-use | 消费-使用 |
| consume-new | 消费-新购 |
| consume-renew | 消费-续费 |
| consume-formalize | 消费-转正 |
| consume-modify | 消费-更配 |
| consume-trial | 消费-试用 |
| refund-terminate | 退款-退订 |
| refund-modify | 退款-更配 |
| transfer-manual | 调账-人工 |
| transfer-system | 调账-系统 |

---

## 七、ListAmortizedCostBillMonthly - 成本账单总览

**文档**：https://www.volcengine.com/docs/6269/1127565

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| AmortizedMonth | String | **是** | 分摊月：YYYY-MM，最多24个月，最早2023-04 |
| Limit | Integer | **是** | 数量：[1-300] |
| Offset | Integer | 否 | 偏移量 |
| AmortizedType | String[] | 否 | 分摊类型 |
| BillingMode | String[] | 否 | 计费模式 |
| BillCategory | String[] | 否 | 账单类型 |
| Product | String[] | 否 | 产品名称 |
| PayerID | Long[] | 否 | Payer账号ID |
| OwnerID | Long[] | 否 | Owner账号ID |
| BillPeriod | String | 否 | 账务账期：YYYY-MM |
| InstanceNo | String | 否 | 实例ID |
| IgnoreZero | Integer | 否 | 是否忽略折后价为0 |
| NeedRecordNum | Integer | 否 | 是否需要总数 |

### AmortizedType 分摊类型枚举

| 值 | 说明 |
|----|------|
| 1 | 履约计费分摊 |
| 2 | 合同计费分摊 |
| 3 | 按量计费分摊 |
| 4 | 新购分摊 |
| 5 | 更配分摊 |
| 6 | 续费分摊 |
| 7 | 退订分摊 |
| 8 | 预留实例调整分摊 |
| 9 | 试用分摊 |
| 10 | 转正分摊 |

---

## 八、ListAmortizedCostBillDetail - 成本账单明细

**文档**：https://www.volcengine.com/docs/6269/1127563

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| AmortizedMonth | String | **是** | 分摊月：YYYY-MM，最多24个月 |
| Limit | Integer | **是** | 数量：[1-300] |
| Offset | Integer | 否 | 偏移量 |
| BillingMode | String[] | 否 | 计费模式 |
| BillCategory | String[] | 否 | 账单类型 |
| AmortizedType | String[] | 否 | 分摊类型 |
| Product | String[] | 否 | 产品名称 |
| PayerID | Long[] | 否 | Payer账号ID |
| OwnerID | Long[] | 否 | Owner账号ID |
| BillPeriod | String | 否 | 账务账期：YYYY-MM |
| AmortizedDay | String | 否 | 分摊日：YYYY-MM-DD，提升查询性能 |
| InstanceNo | String | 否 | 实例ID |
| IgnoreZero | Integer | 否 | 是否忽略折后价为0 |
| NeedRecordNum | Integer | 否 | 是否需要总数 |

---

## 九、ListAmortizedCostBillDaily - 成本账单按天

**文档**：https://www.volcengine.com/docs/6269/1215981

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| AmortizedMonth | String | **是** | 分摊月：YYYY-MM，最多24个月 |
| Limit | Integer | **是** | 数量：[1-300] |
| Offset | Integer | 否 | 偏移量 |
| AmortizedDay | String | 否 | 分摊日：YYYY-MM-DD，提升查询性能 |
| AmortizedType | String[] | 否 | 分摊类型 |
| BillingMode | String[] | 否 | 计费模式 |
| BillCategory | String[] | 否 | 账单类型 |
| Product | String[] | 否 | 产品名称 |
| PayerID | Long[] | 否 | Payer账号ID |
| OwnerID | Long[] | 否 | Owner账号ID |
| BillPeriod | String | 否 | 账务账期：YYYY-MM |
| InstanceNo | String | 否 | 实例ID |
| IgnoreZero | Integer | 否 | 是否忽略折后价为0 |
| NeedRecordNum | Integer | 否 | 是否需要总数 |

---

## 十、QueryBalanceAcct - 账户余额查询

**文档**：https://www.volcengine.com/docs/6269/1223898

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| Action | String | **是** | QueryBalanceAcct |
| Version | String | **是** | 2022-01-01 |

### 返回参数

| 参数 | 类型 | 描述 |
|------|------|------|
| ArrearsBalance | String | 欠费金额 |
| AvailableBalance | String | 可用余额 |
| CashBalance | String | 现金余额 |
| CreditLimit | String | 信控额度 |
| FreezeAmount | String | 冻结金额 |
| AccountID | Integer | 账号ID |

### 返回示例

```json
{
  "Result": {
    "AccountID": 210xxxxxxx,
    "ArrearsBalance": "1.01",
    "AvailableBalance": "77.01",
    "CashBalance": "83.01",
    "CreditLimit": "0.01",
    "FreezeAmount": "5.01"
  }
}
```

---

## 十一、通用参数枚举

### 11.1 计费模式 BillingMode

| 值 | 名称 | 说明 |
|----|------|------|
| 1 | 包年包月 | 预付费 |
| 2 | 按量计费 | 后付费 |
| 3 | 合同计费 | 合同定价 |
| 4 | 履约计费 | 履约订单 |

### 11.2 账单大类 BillCategoryParent

| 值 | 名称 | 说明 |
|----|------|------|
| consume | 消费 | 正常消费 |
| refund | 退款 | 退款订单 |
| transfer | 调账 | 账户调账 |

### 11.3 支付状态 PayStatus

| 值 | 名称 | 说明 |
|----|------|------|
| CompletedSettle | 已结清 | 已完成结算 |
| PartSettle | 未结清 | 部分结算 |
| Unsettle | 未结算 | 等待结算 |

---

## 十二、注意事项

1. **时间格式**：账期用 YYYY-MM（如 2024-01），日期用 YYYY-MM-DD（如 2024-01-15）
2. **查询范围**：最多查询距今24个月，最早可查2022-01
3. **限流**：账单管理 API 单账号 5 QPS
4. **分页**：Limit 最大 300
5. **性能优化**：建议传入 ExpenseDate 或 AmortizedDay 提升查询性能
6. **GroupTerm**：`ListBillDetail` 必需此参数，指定分组维度
