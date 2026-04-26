import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL 是必填项' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    console.log(`Fetching URL: ${url}`);
    const response = await client.fetch(url);

    return NextResponse.json({
      success: response.status_code === 0,
      title: response.title,
      url: response.url,
      doc_id: response.doc_id,
      filetype: response.filetype,
      publish_time: response.publish_time,
      content: response.content,
      status_code: response.status_code,
      status_message: response.status_message,
    });
  } catch (error) {
    console.error('Fetch URL error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取 URL 内容失败' },
      { status: 500 }
    );
  }
}
