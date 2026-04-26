/**
 * 文件解析服务
 * 支持解析 PDF、Word、Excel、文本等文件，提取内容用于学习
 */

import { FetchClient } from 'coze-coding-dev-sdk';

export interface ParsedDocument {
  title: string;
  content: string;
  summary: string;
  keywords: string[];
  metadata: {
    fileType: string;
    fileSize: number;
    pageCount?: number;
    wordCount: number;
  };
}

export interface DocumentChunk {
  id: string;
  content: string;
  position: number;
}

/**
 * 文件解析器类
 */
export class FileParserService {
  /**
   * 解析上传的文件
   */
  async parseFile(file: {
    url: string;
    name: string;
    type: string;
    size: number;
  }): Promise<ParsedDocument> {
    const fileExtension = this.getFileExtension(file.name);
    
    try {
      // 使用 FetchClient 解析文档内容
      const fetchClient = new FetchClient();
      const results = await fetchClient.fetch(file.url);
      
      // FetchClient 返回的是数组，取第一个元素的内容
      const textContent = Array.isArray(results) && results.length > 0 
        ? (results[0].content || '') 
        : '';
      
      // 提取关键词
      const keywords = await this.extractKeywords(textContent);
      
      // 生成摘要
      const summary = await this.generateSummary(textContent, keywords);
      
      return {
        title: this.extractTitle(file.name, textContent),
        content: textContent,
        summary,
        keywords,
        metadata: {
          fileType: fileExtension,
          fileSize: file.size,
          wordCount: textContent.length,
        },
      };
    } catch (error) {
      console.error('文件解析失败:', error);
      
      // 如果解析失败，返回基本信息
      return {
        title: file.name,
        content: '',
        summary: `文件 ${file.name} 解析失败，请确保文件格式正确`,
        keywords: [fileExtension, '解析失败'],
        metadata: {
          fileType: fileExtension,
          fileSize: file.size,
          wordCount: 0,
        },
      };
    }
  }

  /**
   * 从 URL 解析文档
   */
  async parseFromUrl(url: string): Promise<ParsedDocument> {
    const fetchClient = new FetchClient();
    
    try {
      const results = await fetchClient.fetch(url);
      
      // FetchClient 返回的是数组，取第一个元素的内容
      const textContent = Array.isArray(results) && results.length > 0 
        ? (results[0].content || '') 
        : '';
      const title = Array.isArray(results) && results.length > 0 
        ? (results[0].title || '') 
        : '';
      
      const keywords = await this.extractKeywords(textContent);
      const summary = await this.generateSummary(textContent, keywords);
      
      return {
        title: title || this.extractTitleFromUrl(url),
        content: textContent,
        summary,
        keywords,
        metadata: {
          fileType: this.getFileExtensionFromUrl(url),
          fileSize: 0,
          wordCount: textContent.length,
        },
      };
    } catch (error) {
      console.error('URL 解析失败:', error);
      throw new Error(`无法解析 URL: ${url}`);
    }
  }

  /**
   * 将文档分块（用于存储和检索）
   */
  chunkDocument(content: string, chunkSize: number = 1000, overlap: number = 100): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    if (content.length <= chunkSize) {
      return [{
        id: crypto.randomUUID(),
        content,
        position: 0,
      }];
    }
    
    let position = 0;
    let start = 0;
    
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      const chunkContent = content.slice(start, end);
      
      chunks.push({
        id: crypto.randomUUID(),
        content: chunkContent,
        position: position++,
      });
      
      start += chunkSize - overlap;
    }
    
    return chunks;
  }

  /**
   * 提取关键词（简单实现，基于词频）
   */
  private async extractKeywords(content: string): Promise<string[]> {
    if (!content || content.length < 50) {
      return [];
    }
    
    // 停用词列表（中文常见停用词）
    const stopWords = new Set([
      '的', '了', '和', '是', '就', '都', '而', '及', '与', '着',
      '或', '一个', '没有', '我们', '你们', '他们', '它们', '这个',
      '那个', '之', '以', '为', '于', '上', '下', '中', '来', '去',
      '在', '有', '这', '那', '要', '也', '不', '人', '他', '她',
      'it', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    ]);
    
    // 分词（简单按标点和空格分割）
    const words = content
      .replace(/[，。！？；：""''【】（）《》、\n\r\t]/g, ' ')
      .split(/\s+/)
      .filter(word => {
        // 过滤掉停用词和短词
        return word.length >= 2 && !stopWords.has(word.toLowerCase());
      });
    
    // 统计词频
    const wordCount = new Map<string, number>();
    for (const word of words) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }
    
    // 按词频排序，取前 10 个关键词
    const sortedWords = Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return sortedWords;
  }

  /**
   * 生成摘要（取内容前 500 字符 + 关键词）
   */
  private async generateSummary(content: string, keywords: string[]): Promise<string> {
    if (!content) {
      return '空文档';
    }
    
    // 取前 500 字符作为摘要基础
    let summary = content.slice(0, 500).trim();
    
    // 如果截断了，添加省略号
    if (content.length > 500) {
      summary += '...';
    }
    
    // 添加关键词标签
    if (keywords.length > 0) {
      summary += `\n\n关键词: ${keywords.join(', ')}`;
    }
    
    return summary;
  }

  /**
   * 提取标题
   */
  private extractTitle(fileName: string, content: string): string {
    // 尝试从内容中提取标题（第一行或第一个标题）
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines.slice(0, 5)) {
      const trimmed = line.trim();
      // 检测可能的标题格式
      if (trimmed.startsWith('#')) {
        return trimmed.replace(/^#+\s*/, '');
      }
      if (trimmed.length > 5 && trimmed.length < 100) {
        return trimmed;
      }
    }
    
    // 如果没有找到，使用文件名
    return fileName.replace(/\.[^/.]+$/, '');
  }

  /**
   * 从 URL 提取标题
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      
      return decodeURIComponent(lastPart.replace(/\.[^/.]+$/, '')) || urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : 'unknown';
  }

  /**
   * 从 URL 获取文件扩展名
   */
  private getFileExtensionFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('.');
      return pathParts.length > 1 ? pathParts.pop()!.toLowerCase() : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * 检查文件类型是否支持
   */
  isSupportedFileType(fileName: string): boolean {
    const supportedExtensions = [
      // 文档
      'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',
      // 表格
      'xls', 'xlsx', 'csv', 'ods',
      // 演示文稿
      'ppt', 'pptx', 'odp',
      // 电子书
      'epub', 'mobi',
      // 网页
      'html', 'htm', 'md',
      // 代码
      'js', 'ts', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'rb', 'php',
      'json', 'xml', 'yaml', 'yml', 'sql', 'sh',
    ];
    
    const ext = this.getFileExtension(fileName);
    return supportedExtensions.includes(ext);
  }

  /**
   * 获取文件类型描述
   */
  getFileTypeDescription(fileName: string): string {
    const ext = this.getFileExtension(fileName);
    
    const typeMap: Record<string, string> = {
      pdf: 'PDF 文档',
      doc: 'Word 文档',
      docx: 'Word 文档',
      xls: 'Excel 表格',
      xlsx: 'Excel 表格',
      ppt: 'PowerPoint 演示文稿',
      pptx: 'PowerPoint 演示文稿',
      txt: '文本文件',
      md: 'Markdown 文档',
      csv: 'CSV 表格',
      json: 'JSON 数据',
      xml: 'XML 数据',
      html: 'HTML 网页',
      epub: 'EPUB 电子书',
      mobi: 'Kindle 电子书',
    };
    
    return typeMap[ext] || `${ext.toUpperCase()} 文件`;
  }
}

// 导出单例
export const fileParserService = new FileParserService();
