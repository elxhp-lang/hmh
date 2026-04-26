import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { query, count = 5 } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '缺少搜索关键词' },
        { status: 400 }
      );
    }

    const config = new Config();
    const client = new SearchClient(config);

    const response = await client.webSearch(query.trim(), count, true);

    // 格式化返回结果
    const results = (response.web_items || []).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      siteName: item.site_name,
      publishTime: item.publish_time,
      authority: item.auth_info_des,
    }));

    return NextResponse.json({
      success: true,
      query,
      summary: response.summary,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('联网搜索失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '搜索失败' },
      { status: 500 }
    );
  }
}
