'use client';

import React, { useMemo } from 'react';

interface RichMessageContentProps {
  content: string;
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

export function RichMessageContent({ content }: RichMessageContentProps) {
  const { links, blocks } = useMemo(() => {
    const collectedLinks = collectMediaLinks(content);
    const cleaned = removeUrls(content, collectedLinks);
    const parsedBlocks = cleaned.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    return { links: collectedLinks, blocks: parsedBlocks };
  }, [content]);

  return (
    <div className="space-y-3">
      {blocks.length === 0 && links.length === 0 && <p className="whitespace-pre-wrap break-words">{content}</p>}

      {blocks.map((block, idx) => {
        const table = tryParseTable(block);
        if (table) {
          return (
            <div key={`table_${idx}`} className="overflow-x-auto rounded-lg border bg-background/70">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {table.headers.map((header, hIdx) => (
                      <th key={`h_${hIdx}`} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rIdx) => (
                    <tr key={`r_${rIdx}`} className="border-t">
                      {row.map((cell, cIdx) => (
                        <td key={`c_${rIdx}_${cIdx}`} className="px-3 py-2 align-top whitespace-pre-wrap">
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
                className="text-xs underline text-primary break-all"
              >
                {link.url}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

