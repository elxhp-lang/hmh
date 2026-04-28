'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePermission } from '@/contexts/AuthContext';
import { useApi } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  Plus,
  AlertCircle,
  Calculator,
  Video,
  Info,
} from 'lucide-react';

interface BillingRecord {
  billing_id: string;
  user_id: string;
  task_id: string;
  task_type: string;
  amount: string;
  status: string;
  created_at: string;
  users?: { username: string };
}

interface InvoiceRecord {
  invoice_id: string;
  invoice_number: string;
  amount: string;
  status: string;
  invoice_type: string;
  company_name: string;
  created_at: string;
}

export default function BillingPage() {
  const { isFinance } = usePermission();
  const { request, token } = useApi();

  // 账单列表
  const [bills, setBills] = useState<BillingRecord[]>([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsPage] = useState(1);
  const [searchUser, setSearchUser] = useState('');

  // 发票列表
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  // 发票申请
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_type: 'normal',
    company_name: '',
    tax_id: '',
    amount: '',
    bank_name: '',
    bank_account: '',
    address: '',
    phone: '',
  });
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);

  // 成本估算状态
  const [videoDuration, setVideoDuration] = useState(15);
  const [hasVideoInput, setHasVideoInput] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [customTokens, setCustomTokens] = useState<number | null>(null);

  // 计算成本
  const calculateCost = () => {
    // 基准：15秒约需 30.888 万 tokens
    const benchmarkTokens = 308880;
    const tokens = customTokens || Math.round(benchmarkTokens * (videoDuration / 15));
    const price = hasVideoInput ? 28 : 46; // 元/百万tokens
    const unitCost = (tokens / 1_000_000) * price;
    const totalCost = unitCost * quantity;
    
    return {
      tokens,
      price,
      unitCost: Math.round(unitCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      costPerSecond: Math.round((unitCost / videoDuration) * 100) / 100,
    };
  };

  const costResult = calculateCost();

  const loadBills = useCallback(async () => {
    try {
      setBillsLoading(true);
      const params = new URLSearchParams({
        page: billsPage.toString(),
        limit: '20',
      });
      if (searchUser && isFinance) {
        params.set('username', searchUser);
      }

      const data = await request<{ bills: BillingRecord[]; total: number }>(`/api/billing?${params}`);
      setBills(data.bills || []);
    } catch (e) {
      console.error('加载账单失败:', e);
    } finally {
      setBillsLoading(false);
    }
  }, [billsPage, isFinance, request, searchUser]);

  const loadInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      const data = await request<{ invoices: InvoiceRecord[] }>('/api/invoice');
      setInvoices(data.invoices || []);
    } catch (e) {
      console.error('加载发票失败:', e);
    } finally {
      setInvoicesLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadBills();
    loadInvoices();
  }, [loadBills, loadInvoices]);

  const handleApplyInvoice = async () => {
    setInvoiceError(null);

    if (!invoiceForm.company_name || !invoiceForm.amount) {
      setInvoiceError('请填写必填项');
      return;
    }

    try {
      setInvoiceSubmitting(true);
      await request('/api/invoice', {
        method: 'POST',
        body: invoiceForm,
      });

      setInvoiceDialogOpen(false);
      loadInvoices();
      setInvoiceForm({
        invoice_type: 'normal',
        company_name: '',
        tax_id: '',
        amount: '',
        bank_name: '',
        bank_account: '',
        address: '',
        phone: '',
      });
    } catch (e) {
      setInvoiceError(e instanceof Error ? e.message : '申请失败');
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const exportBilling = async () => {
    try {
      const response = await fetch(`/api/billing/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('导出失败:', e);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">账单管理</h1>
            <p className="text-muted-foreground">查看消费明细和申请发票</p>
          </div>
        </div>

        <Tabs defaultValue="billing">
          <TabsList>
            <TabsTrigger value="billing">消费明细</TabsTrigger>
            <TabsTrigger value="calculator">成本估算</TabsTrigger>
            <TabsTrigger value="invoice">发票管理</TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="space-y-4">
            {/* 搜索和筛选 */}
            <Card>
              <CardContent className="py-4">
                <div className="flex gap-4">
                  {isFinance && (
                    <div className="flex-1">
                      <Input
                        placeholder="搜索用户名..."
                        value={searchUser}
                        onChange={(e) => setSearchUser(e.target.value)}
                        className="max-w-sm"
                      />
                    </div>
                  )}
                  {isFinance && (
                    <Button variant="outline" onClick={exportBilling}>
                      <Download className="h-4 w-4 mr-2" />
                      导出
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 账单列表 */}
            <Card>
              <CardContent>
                {billsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : bills.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无消费记录</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>时间</TableHead>
                        {isFinance && <TableHead>用户</TableHead>}
                        <TableHead>任务类型</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bills.map((bill) => (
                        <TableRow key={bill.billing_id}>
                          <TableCell>
                            {new Date(bill.created_at).toLocaleString('zh-CN')}
                          </TableCell>
                          {isFinance && (
                            <TableCell>
                              {(bill.users as { username: string })?.username || '-'}
                            </TableCell>
                          )}
                          <TableCell>{bill.task_type}</TableCell>
                          <TableCell className="font-medium">
                            ¥{parseFloat(bill.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={bill.status === 'paid' ? 'default' : 'secondary'}>
                              {bill.status === 'paid' ? '已支付' : '待支付'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 成本估算 Tab */}
          <TabsContent value="calculator" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* 输入卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    视频成本估算
                  </CardTitle>
                  <CardDescription>根据参数估算 Seedance 2.0 视频生成费用</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 视频时长 */}
                  <div className="space-y-2">
                    <Label htmlFor="duration">视频时长（秒）</Label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        id="duration"
                        min="5"
                        max="30"
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-16 text-center font-medium">{videoDuration}秒</span>
                    </div>
                  </div>

                  {/* 生成模式 */}
                  <div className="space-y-2">
                    <Label>生成模式</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setHasVideoInput(false)}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          !hasVideoInput 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="font-medium">文生视频</div>
                        <div className="text-xs text-muted-foreground mt-1">无视频参考输入</div>
                        <div className="text-sm font-bold mt-2 text-primary">46元/百万tokens</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasVideoInput(true)}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          hasVideoInput 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="font-medium">图生视频/延长</div>
                        <div className="text-xs text-muted-foreground mt-1">有视频参考输入</div>
                        <div className="text-sm font-bold mt-2 text-primary">28元/百万tokens</div>
                      </button>
                    </div>
                  </div>

                  {/* 生成数量 */}
                  <div className="space-y-2">
                    <Label htmlFor="quantity">生成数量</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max="100"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    />
                  </div>

                  {/* 高级选项：自定义 Token 数 */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <Info className="h-4 w-4" />
                      高级选项
                    </summary>
                    <div className="mt-3 space-y-2">
                      <Label htmlFor="tokens">自定义 Token 数（留空使用默认值）</Label>
                      <Input
                        id="tokens"
                        type="number"
                        placeholder={`默认 ${costResult.tokens.toLocaleString()}`}
                        value={customTokens || ''}
                        onChange={(e) => setCustomTokens(e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                  </details>
                </CardContent>
              </Card>

              {/* 结果卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    估算结果
                  </CardTitle>
                  <CardDescription>基于当前参数的费用估算</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 主要费用 */}
                  <div className="text-center p-6 bg-primary/5 rounded-lg">
                    <div className="text-4xl font-bold text-primary">
                      ¥{costResult.totalCost}
                    </div>
                    <div className="text-muted-foreground mt-2">
                      {quantity > 1 ? `共 ${quantity} 条视频` : '单条视频'}
                    </div>
                  </div>

                  {/* 详细分解 */}
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">预估 Token 数</span>
                      <span className="font-medium">{costResult.tokens.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">单价</span>
                      <span className="font-medium">{costResult.price}元/百万tokens</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">单条成本</span>
                      <span className="font-medium">¥{costResult.unitCost}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">每秒成本</span>
                      <span className="font-medium">¥{costResult.costPerSecond}/秒</span>
                    </div>
                    {quantity > 1 && (
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">总价</span>
                        <span className="font-bold text-primary">¥{costResult.totalCost}</span>
                      </div>
                    )}
                  </div>

                  {/* 提示信息 */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <p>• 实际费用可能因视频复杂度略有差异</p>
                      <p>• 费用将按月从账户余额中扣除</p>
                      <p>• 建议开启预算告警避免超额</p>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>

            {/* 价格表 */}
            <Card>
              <CardHeader>
                <CardTitle>价格参考表</CardTitle>
                <CardDescription>火山引擎 Seedance 2.0 官方定价（2026年3月）</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>服务类型</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>15秒成本估算</TableHead>
                      <TableHead>说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">文生视频</TableCell>
                      <TableCell>46元/百万tokens</TableCell>
                      <TableCell className="font-medium text-primary">约 ¥14.2</TableCell>
                      <TableCell>无视频参考输入</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">图生视频</TableCell>
                      <TableCell>28元/百万tokens</TableCell>
                      <TableCell className="font-medium text-primary">约 ¥8.6</TableCell>
                      <TableCell>有图片参考输入</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">视频延长</TableCell>
                      <TableCell>28元/百万tokens</TableCell>
                      <TableCell className="font-medium text-primary">约 ¥8.6</TableCell>
                      <TableCell>延长现有视频</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">首帧生成</TableCell>
                      <TableCell>28元/百万tokens</TableCell>
                      <TableCell className="font-medium text-primary">约 ¥8.6</TableCell>
                      <TableCell>生成视频首帧</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoice" className="space-y-4">
            {/* 申请发票按钮 */}
            <div className="flex justify-end">
              <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    申请发票
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>申请发票</DialogTitle>
                    <DialogDescription>请填写发票信息</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {invoiceError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{invoiceError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label>发票类型</Label>
                      <Select
                        value={invoiceForm.invoice_type}
                        onValueChange={(v) => setInvoiceForm({ ...invoiceForm, invoice_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">普通发票</SelectItem>
                          <SelectItem value="special">增值税专用发票</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>公司名称 *</Label>
                      <Input
                        value={invoiceForm.company_name}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, company_name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>纳税人识别号</Label>
                      <Input
                        value={invoiceForm.tax_id}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, tax_id: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>开票金额 *</Label>
                      <Input
                        type="number"
                        value={invoiceForm.amount}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                      />
                    </div>

                    {invoiceForm.invoice_type === 'special' && (
                      <>
                        <div className="space-y-2">
                          <Label>开户银行</Label>
                          <Input
                            value={invoiceForm.bank_name}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, bank_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>银行账号</Label>
                          <Input
                            value={invoiceForm.bank_account}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, bank_account: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <DialogFooter>
                    <Button onClick={handleApplyInvoice} disabled={invoiceSubmitting}>
                      {invoiceSubmitting ? '提交中...' : '提交申请'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* 发票列表 */}
            <Card>
              <CardContent>
                {invoicesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : invoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无发票记录</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>发票号</TableHead>
                        <TableHead>公司名称</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>申请时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.invoice_id}>
                          <TableCell>{invoice.invoice_number || '-'}</TableCell>
                          <TableCell>{invoice.company_name}</TableCell>
                          <TableCell className="font-medium">
                            ¥{parseFloat(invoice.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {invoice.invoice_type === 'special' ? '专票' : '普票'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                invoice.status === 'completed'
                                  ? 'default'
                                  : invoice.status === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {invoice.status === 'completed'
                                ? '已开票'
                                : invoice.status === 'rejected'
                                ? '已拒绝'
                                : '处理中'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(invoice.created_at).toLocaleString('zh-CN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
