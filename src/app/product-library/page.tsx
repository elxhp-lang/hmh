'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Upload,
  Trash2,
  Package,
  Image as ImageIcon,
  Eye,
  X,
  Loader2,
  Search,
  Grid3X3,
  Check,
  AlertCircle,
  Users,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

/** 商品图片信息 */
interface ProductImage {
  view_name: string;
  key: string;
  url: string;
  uploaded_at: string;
}

/** 商品信息 */
interface Product {
  id: string;
  user_id: string;
  product_name: string;
  product_description?: string;
  category?: string;
  tags: string[];
  images: ProductImage[];
  primary_image_index: number;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

interface RealAsset {
  id: string;
  asset_id: string;
  asset_url?: string;
  name: string;
  description?: string;
  category?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

/** 视角选项 */
const VIEW_OPTIONS = [
  { value: '正面', label: '正面' },
  { value: '侧面', label: '侧面' },
  { value: '背面', label: '背面' },
  { value: '俯视', label: '俯视' },
  { value: '细节', label: '细节' },
  { value: '包装', label: '包装' },
  { value: '使用场景', label: '使用场景' },
  { value: '其他', label: '其他' },
];

export default function ProductLibraryPage() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'products' | 'actors'>('products');

  // 创建商品对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    product_name: '',
    product_description: '',
    category: '',
  });
  const [creating, setCreating] = useState(false);

  // 上传图片对话框
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedView, setSelectedView] = useState('正面');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 商品详情对话框
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [realAssets, setRealAssets] = useState<RealAsset[]>([]);
  const [realAssetsLoading, setRealAssetsLoading] = useState(false);
  const [realAssetKeyword, setRealAssetKeyword] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const debouncedRealAssetKeyword = useDebouncedValue(realAssetKeyword, 300);

  // 加载商品列表
  const loadProducts = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const url = debouncedSearchQuery
        ? `/api/product-library?search=${encodeURIComponent(debouncedSearchQuery)}`
        : '/api/product-library';

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('加载商品列表失败:', error);
      toast.error('加载商品列表失败');
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearchQuery]);

  const loadRealAssets = useCallback(async () => {
    if (!token) return;
    setRealAssetsLoading(true);
    try {
      const params = new URLSearchParams({ status: 'all' });
      if (debouncedRealAssetKeyword.trim()) {
        params.set('keyword', debouncedRealAssetKeyword.trim());
      }
      const response = await fetch(`/api/real-assets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRealAssets(data.assets || []);
      } else {
        toast.error('加载演员素材失败');
      }
    } catch (error) {
      console.error('加载演员素材失败:', error);
      toast.error('加载演员素材失败');
    } finally {
      setRealAssetsLoading(false);
    }
  }, [token, debouncedRealAssetKeyword]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (activeTab === 'actors') {
      loadRealAssets();
    }
  }, [activeTab, loadRealAssets]);

  // 创建商品
  const handleCreateProduct = async () => {
    if (!newProduct.product_name.trim()) {
      toast.error('请输入商品名称');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/product-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newProduct),
      });

      if (response.ok) {
        const data = await response.json();
        setProducts([data.product, ...products]);
        setCreateDialogOpen(false);
        setNewProduct({ product_name: '', product_description: '', category: '' });
        toast.success('商品创建成功');
      } else {
        const error = await response.json();
        toast.error(error.error || '创建失败');
      }
    } catch (error) {
      console.error('创建商品失败:', error);
      toast.error('创建商品失败');
    } finally {
      setCreating(false);
    }
  };

  // 打开上传图片对话框
  const openUploadDialog = (product: Product) => {
    setSelectedProduct(product);
    setSelectedView('正面');
    setUploadDialogOpen(true);
  };

  // 上传图片
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('不支持的图片格式');
      return;
    }

    // 验证文件大小（最大10MB）
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过10MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('productId', selectedProduct.id);
      formData.append('viewName', selectedView);
      formData.append('file', file);

      const response = await fetch('/api/product-library/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // 更新商品列表中的图片
        setProducts(products.map(p =>
          p.id === selectedProduct.id
            ? { ...p, images: [...p.images, data.image] }
            : p
        ));
        setUploadDialogOpen(false);
        toast.success('图片上传成功');
      } else {
        const error = await response.json();
        toast.error(error.error || '上传失败');
      }
    } catch (error) {
      console.error('上传图片失败:', error);
      toast.error('上传图片失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 删除商品图片
  const handleDeleteImage = async (product: Product, imageKey: string) => {
    try {
      const response = await fetch(
        `/api/product-library?id=${product.id}&imageKey=${encodeURIComponent(imageKey)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        setProducts(products.map(p =>
          p.id === product.id
            ? { ...p, images: p.images.filter(img => img.key !== imageKey) }
            : p
        ));
        toast.success('图片删除成功');
      }
    } catch (error) {
      console.error('删除图片失败:', error);
      toast.error('删除图片失败');
    }
  };

  // 删除商品
  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/product-library?id=${deletingProduct.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setProducts(products.filter(p => p.id !== deletingProduct.id));
        setDeleteDialogOpen(false);
        setDeletingProduct(null);
        toast.success('商品删除成功');
      }
    } catch (error) {
      console.error('删除商品失败:', error);
      toast.error('删除商品失败');
    } finally {
      setDeleting(false);
    }
  };

  // 查看商品详情
  const viewProductDetail = (product: Product) => {
    setViewingProduct(product);
    setDetailDialogOpen(true);
  };

  const copyAssetReference = async (assetId: string) => {
    try {
      await navigator.clipboard.writeText(`asset://${assetId}`);
      toast.success('已复制 asset 引用');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面标题 - 火山引擎风格 */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-background to-accent/5 p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">素材中心</h1>
                <p className="text-muted-foreground">
                  统一管理商品素材与演员素材。演员素材生成时使用 asset:// 引用，asset_url 用于预览。
                </p>
              </div>
            </div>
            {activeTab === 'products' && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加商品
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as 'products' | 'actors')}>
          <TabsList>
            <TabsTrigger value="products">商品素材</TabsTrigger>
            <TabsTrigger value="actors">演员素材</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6 mt-4">
            {/* 搜索栏 */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索商品名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary" className="h-6">
                共 {products.length} 个商品
              </Badge>
            </div>

            {/* 商品列表 */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">暂无商品</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加第一个商品
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{product.product_name}</CardTitle>
                          {product.category && (
                            <Badge variant="outline" className="mt-1">
                              {product.category}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => viewProductDetail(product)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingProduct(product);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {product.product_description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {product.product_description}
                        </p>
                      )}

                      {/* 图片预览 */}
                      <div className="mb-3">
                        {product.images.length > 0 ? (
                          <div className="grid grid-cols-4 gap-1">
                            {product.images.slice(0, 4).map((img) => (
                              <div
                                key={img.key}
                                className="aspect-square relative rounded overflow-hidden bg-muted"
                              >
                                <img
                                  src={img.url}
                                  alt={img.view_name}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-0.5 text-center">
                                  {img.view_name}
                                </div>
                              </div>
                            ))}
                            {product.images.length > 4 && (
                              <div className="aspect-square rounded bg-muted flex items-center justify-center text-sm text-muted-foreground">
                                +{product.images.length - 4}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="aspect-video rounded bg-muted flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                              <ImageIcon className="h-8 w-8 mx-auto mb-1" />
                              <p className="text-xs">暂无图片</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 图片数量和操作 */}
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">
                          {product.images.length} 张图片
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openUploadDialog(product)}
                        >
                          <Upload className="mr-1 h-3 w-3" />
                          上传
                        </Button>
                      </div>

                      {/* 使用统计 */}
                      {product.usage_count > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          已使用 {product.usage_count} 次
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="actors" className="space-y-6 mt-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索演员名称..."
                  value={realAssetKeyword}
                  onChange={(e) => setRealAssetKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={loadRealAssets}>刷新</Button>
              <Badge variant="secondary" className="h-6">
                共 {realAssets.length} 个演员素材
              </Badge>
            </div>

            {realAssetsLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : realAssets.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">暂无演员素材</p>
                  <p className="text-xs text-muted-foreground">请由管理员在 /api/real-assets 录入素材</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {realAssets.map(asset => (
                  <Card key={asset.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="aspect-video rounded-md bg-muted overflow-hidden mb-3">
                        {asset.asset_url ? (
                          <img
                            src={asset.asset_url}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            无预览图
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate">{asset.name}</p>
                          <Badge variant={asset.status === 'active' ? 'default' : 'secondary'}>
                            {asset.status}
                          </Badge>
                        </div>
                        {asset.category && (
                          <p className="text-xs text-muted-foreground">分类：{asset.category}</p>
                        )}
                        {asset.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{asset.description}</p>
                        )}
                        <div className="rounded border bg-muted/30 px-2 py-1 text-xs font-mono break-all">
                          asset://{asset.asset_id}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => copyAssetReference(asset.asset_id)}
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            复制引用
                          </Button>
                          {asset.asset_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(asset.asset_url, '_blank')}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* 创建商品对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加商品</DialogTitle>
            <DialogDescription>
              创建商品后，可以上传多视角的商品图片。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">商品名称 *</Label>
              <Input
                id="name"
                value={newProduct.product_name}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, product_name: e.target.value })
                }
                placeholder="输入商品名称"
              />
            </div>
            <div>
              <Label htmlFor="description">商品描述</Label>
              <Textarea
                id="description"
                value={newProduct.product_description}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, product_description: e.target.value })
                }
                placeholder="简要描述商品特点（可选）"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="category">分类</Label>
              <Input
                id="category"
                value={newProduct.category}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, category: e.target.value })
                }
                placeholder="如：美妆、数码、食品等（可选）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateProduct} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 上传图片对话框 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上传商品图片</DialogTitle>
            <DialogDescription>
              为「{selectedProduct?.product_name}」上传商品图片
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>选择视角</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {VIEW_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={selectedView === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedView(option.value)}
                  >
                    {selectedView === option.value && (
                      <Check className="mr-1 h-3 w-3" />
                    )}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>选择图片</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleUploadImage}
                disabled={uploading}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                支持 JPG、PNG、WebP、GIF，最大 10MB
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 商品详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingProduct?.product_name}</DialogTitle>
            <DialogDescription>
              {viewingProduct?.category && (
                <Badge variant="outline" className="mr-2">
                  {viewingProduct.category}
                </Badge>
              )}
              {viewingProduct?.product_description}
            </DialogDescription>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">商品图片 ({viewingProduct.images.length})</h4>
                {viewingProduct.images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {viewingProduct.images.map((img) => (
                      <div key={img.key} className="relative group">
                        <div className="aspect-square rounded overflow-hidden bg-muted">
                          <img
                            src={img.url}
                            alt={img.view_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              window.open(img.url, '_blank');
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              handleDeleteImage(viewingProduct, img.key);
                              setViewingProduct({
                                ...viewingProduct,
                                images: viewingProduct.images.filter(i => i.key !== img.key),
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-center text-sm mt-1">{img.view_name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video rounded bg-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                      <p>暂无图片</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>使用次数: {viewingProduct.usage_count}</span>
                <span>
                  创建于: {new Date(viewingProduct.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => viewingProduct && openUploadDialog(viewingProduct)}
            >
              <Upload className="mr-2 h-4 w-4" />
              上传图片
            </Button>
            <Button onClick={() => setDetailDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deletingProduct?.product_name}」吗？该操作将同时删除所有关联的商品图片，且无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
