'use client';

import React, { useMemo } from 'react';
import type { MessagePart } from '@/lib/agent-sse';

interface RichMessageContentProps {
  content: string;
  parts?: MessagePart[];
}

type MediaLink = {
  url: string;
  type: 'image' | 'video' | 'link';
};

type TableBlock = {
  headers: string[];
  rows: string[][];
};

type CodeBlock = {
  language: string;
  code: string;
};

const URL_REGEX = /(https?:\/\/[^\s)]+)/g;

function classifyUrl(url: string): MediaLink['type'] {
  const normalized = url.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp)(\?|$)/.test(normalized)) return 'image';
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(normalized)) return 'video';
  return 'link';
}

function collectMediaLinks(content: string): MediaLink[] {
  const matches = Array.from(content.matchAll(URL_REGEX)).map((item) => item[1]).filter(Boolean);
  const unique = Array.from(new Set(matches));
  return unique.map((url) => ({ url, type: classifyUrl(url) }));
}

function removeUrls(content: string, links: MediaLink[]): string {
  let next = content;
  for (const link of links) {
    next = next.replaceAll(link.url, '');
  }
  return next.replace(/\n{3,}/g, '\n\n').trim();
}

function tryParseTable(block: string): TableBlock | null {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) return null;
  if (!lines.every((line) => line.includes('|'))) return null;

  const separatorIndex = lines.findIndex((line) => /^\|?\s*[-:| ]+\s*\|?$/.test(line));
  if (separatorIndex !== 1) return null;

  const parseCells = (line: string) =>
    line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

  const headers = parseCells(lines[0]);
  const rows = lines.slice(2).map(parseCells).filter((cells) => cells.length > 0);
  if (headers.length === 0 || rows.length === 0) return null;

  return { headers, rows };
}

function tryParseCodeBlock(block: string): CodeBlock | null {
  const match = block.match(/^```([\w-]*)\n([\s\S]*?)\n```$/);
  if (!match) return null;
  return {
    language: match[1] || 'text',
    code: (match[2] || '').trim(),
  };
}

export function RichMessageContent({ content, parts = [] }: RichMessageContentProps) {
  const { links, blocks } = useMemo(() => {
    const collectedLinks = collectMediaLinks(content);
    const cleaned = removeUrls(content, collectedLinks);
    const parsedBlocks = cleaned.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    return { links: collectedLinks, blocks: parsedBlocks };
  }, [content]);

  return (
    <div className="space-y-3">
      {parts.map((part, pIdx) => {
        if (part.type === 'table') {
          return (
            <div key={`part_table_${pIdx}`} className="overflow-x-auto rounded-xl border bg-background/80 shadow-sm">
              {part.title && <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">{part.title}</div>}
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {part.columns.map((header, hIdx) => (
                      <th key={`ph_${pIdx}_${hIdx}`} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap text-foreground/90">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {part.rows.map((row, rIdx) => (
                    <tr key={`pr_${pIdx}_${rIdx}`} className="border-t odd:bg-background even:bg-muted/20">
                      {row.map((cell, cIdx) => (
                        <td key={`pc_${pIdx}_${rIdx}_${cIdx}`} className="px-3 py-2.5 align-top whitespace-pre-wrap leading-relaxed">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (part.type === 'image') {
          return (
            <a key={`part_img_${pIdx}`} href={part.url} target="_blank" rel="noopener noreferrer" className="block">
              <img src={part.url} alt={part.alt || `图片预览 ${pIdx + 1}`} className="max-w-[320px] max-h-[260px] rounded-lg border object-cover" />
            </a>
          );
        }
        if (part.type === 'video') {
          return (
            <div key={`part_video_${pIdx}`} className="rounded-lg border overflow-hidden bg-black/80">
              <video src={part.url} controls poster={part.poster} className="w-full max-w-[380px] max-h-[280px]" preload="metadata" />
            </div>
          );
        }
        if (part.type === 'card') {
          const cardData = part.data || {};
          const dataRecord = cardData as Record<string, unknown>;
          if (part.cardType === 'video_analysis') {
            return (
              <div key={`part_card_${pIdx}`} className="rounded-lg border bg-background/60 px-3 py-2 text-xs space-y-1">
                <p className="font-medium">视频分析</p>
                <p className="text-muted-foreground">类型：{String(dataRecord.videoType ?? '-')}</p>
                <p className="text-muted-foreground">风格：{String(dataRecord.videoStyle ?? '-')}</p>
                <p className="text-muted-foreground">受众：{String(dataRecord.targetAudience ?? '-')}</p>
                <p className="text-muted-foreground">基调：{String(dataRecord.emotionalTone ?? '-')}</p>
              </div>
            );
          }
          if (part.cardType === 'tool_result') {
            return (
              <div key={`part_card_${pIdx}`} className="rounded-lg border bg-background/60 px-3 py-2 text-xs space-y-1">
                <p className="font-medium">工具执行结果</p>
                <p className="text-muted-foreground">工具：{String(dataRecord.tool ?? '-')}</p>
                <p className="text-muted-foreground">
                  状态：{dataRecord.success ? '成功' : '失败'}
                </p>
                {typeof dataRecord.error === 'string' && dataRecord.error && (
                  <p className="text-destructive/80 break-words">错误：{dataRecord.error}</p>
                )}
              </div>
            );
          }
          if (part.cardType === 'task_submitted' || part.cardType === 'task_done') {
            return (
              <div key={`part_card_${pIdx}`} className="rounded-lg border bg-background/60 px-3 py-2 text-xs space-y-1">
                <p className="font-medium">{part.cardType === 'task_done' ? '任务完成' : '任务已提交'}</p>
                {typeof dataRecord.content === 'string' && dataRecord.content && (
                  <p className="text-muted-foreground whitespace-pre-wrap break-words">{dataRecord.content}</p>
                )}
              </div>
            );
          }
          return (
            <div key={`part_card_${pIdx}`} className="rounded-lg border bg-background/60 px-3 py-2 text-xs">
              <p className="font-medium mb-1">{part.cardType}</p>
              <pre className="whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(part.data, null, 2)}</pre>
            </div>
          );
        }
        return null;
      })}

      {blocks.length === 0 && links.length === 0 && <p className="whitespace-pre-wrap break-words">{content}</p>}

      {blocks.map((block, idx) => {
        const table = tryParseTable(block);
        if (table) {
          return (
            <div key={`table_${idx}`} className="overflow-x-auto rounded-xl border bg-background/80 shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {table.headers.map((header, hIdx) => (
                      <th key={`h_${hIdx}`} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap text-foreground/90">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rIdx) => (
                    <tr key={`r_${rIdx}`} className="border-t odd:bg-background even:bg-muted/20">
                      {row.map((cell, cIdx) => (
                        <td key={`c_${rIdx}_${cIdx}`} className="px-3 py-2.5 align-top whitespace-pre-wrap leading-relaxed">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const codeBlock = tryParseCodeBlock(block);
        if (codeBlock) {
          return (
            <div key={`code_${idx}`} className="rounded-lg border bg-background/80 overflow-hidden">
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b bg-muted/40">
                {codeBlock.language}
              </div>
              <pre className="px-3 py-2 text-xs whitespace-pre-wrap overflow-x-auto">
                {codeBlock.code}
              </pre>
            </div>
          );
        }

        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const isList = lines.every((line) => /^[-*•]\s+/.test(line));
        if (isList) {
          return (
            <ul key={`list_${idx}`} className="list-disc pl-5 space-y-1">
              {lines.map((line, liIdx) => (
                <li key={`li_${liIdx}`} className="whitespace-pre-wrap break-words">
                  {line.replace(/^[-*•]\s+/, '')}
                </li>
              ))}
            </ul>
          );
        }

        const isLongParagraph = block.length > 420;
        if (isLongParagraph) {
          return (
            <details key={`p_${idx}`} className="group rounded-lg border bg-background/40 px-3 py-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                展开长文本
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">
                {block}
              </p>
            </details>
          );
        }

        return <p key={`p_${idx}`} className="whitespace-pre-wrap break-words leading-relaxed">{block}</p>;
      })}

      {links.length > 0 && (
        <div className="space-y-2 pt-1">
          {links.map((link, idx) => {
            if (link.type === 'image') {
              return (
                <a key={`img_${idx}`} href={link.url} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={link.url}
                    alt={`图片预览 ${idx + 1}`}
                    className="max-w-[320px] max-h-[260px] rounded-lg border object-cover"
                  />
                </a>
              );
            }
            if (link.type === 'video') {
              return (
                <div key={`video_${idx}`} className="rounded-lg border overflow-hidden bg-black/80">
                  <video src={link.url} controls className="w-full max-w-[380px] max-h-[280px]" preload="metadata" />
                </div>
              );
            }
            return (
              <a
                key={`link_${idx}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border bg-background/70 px-3 py-2 text-xs text-primary break-all hover:bg-muted/30 transition-colors"
              >
                <span className="text-[10px] text-muted-foreground mr-2">链接</span>
                {link.url}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

