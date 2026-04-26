/**
 * 视频生成轮询服务
 * 
 * 功能：
 * 1. 定时扫描 videos 表 status=pending/processing 的记录
 * 2. 拿着 seedance_task_id 查询 Seedance 进度
 * 3. 生成成功：下载视频到 TOS，更新 status=completed，保存 public_video_url
 * 4. 生成失败：更新 status=failed，保存 error_reason
 * 5. 调用回调 API 通知创意小海
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { SeedanceClient } from './seedance-client';
import { VideoStorageService } from './tos-storage';

export class VideoGenerationPoller {
  // 延迟初始化，避免构建时检查环境变量
  private _supabase: ReturnType<typeof getSupabaseClient> | null = null;
  private _seedance: SeedanceClient | null = null;
  private isRunning = false;
  private pollInterval = 30000; // 30秒轮询一次
  private timer: NodeJS.Timeout | null = null;

  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabaseClient();
    }
    return this._supabase;
  }

  private get seedance() {
    if (!this._seedance) {
      this._seedance = new SeedanceClient();
    }
    return this._seedance;
  }

  /**
   * 启动轮询服务
   */
  start() {
    if (this.isRunning) {
      console.log('[VideoPoller] 轮询服务已在运行中');
      return;
    }

    console.log('[VideoPoller] 启动轮询服务');
    this.isRunning = true;
    this.poll(); // 立即执行一次
    this.timer = setInterval(() => this.poll(), this.pollInterval);
  }

  /**
   * 停止轮询服务
   */
  stop() {
    console.log('[VideoPoller] 停止轮询服务');
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 执行一次轮询
   */
  private async poll() {
    if (!this.isRunning) return;

    try {
      console.log('[VideoPoller] 开始轮询...');

      // 1. 查询 pending/processing 状态的视频
      const { data: videos, error } = await this.supabase
        .from('videos')
        .select('*')
        .in('status', ['pending', 'processing']);

      if (error) {
        console.error('[VideoPoller] 查询视频失败:', error);
        return;
      }

      if (!videos || videos.length === 0) {
        console.log('[VideoPoller] 没有待处理的视频');
        return;
      }

      console.log(`[VideoPoller] 发现 ${videos.length} 个待处理视频`);

      // 2. 逐个处理
      for (const video of videos) {
        await this.processVideo(video);
      }

    } catch (error) {
      console.error('[VideoPoller] 轮询出错:', error);
    }
  }

  /**
   * 处理单个视频
   */
  private async processVideo(video: any) {
    const videoId = video.id;
    const seedanceTaskId = video.task_id || video.seedance_task_id;  // 兼容两种字段名
    const userId = video.user_id;

    if (!seedanceTaskId) {
      console.warn(`[VideoPoller] 视频 ${videoId} 没有 task_id，标记为失败`);
      
      // 标记为失败
      try {
        await this.supabase
          .from('videos')
          .update({ 
            status: 'failed', 
            error_message: '缺少 task_id，无法查询任务状态' 
          })
          .eq('id', videoId);
        console.log(`[VideoPoller] 视频 ${videoId} 已标记为失败`);
      } catch (error) {
        console.error(`[VideoPoller] 更新视频状态失败: ${error}`);
      }
      
      return;
    }

    console.log(`[VideoPoller] 处理视频: ${videoId}, Seedance任务: ${seedanceTaskId}`);

    try {
      // 1. 查询 Seedance 任务状态
      const taskStatus = await this.seedance.getTask(seedanceTaskId);
      console.log(`[VideoPoller] Seedance任务状态: ${taskStatus.status}`);

      // 2. 根据状态处理
      if (taskStatus.status === 'succeeded') {
        await this.handleSuccess(videoId, userId, taskStatus);
      } else if (taskStatus.status === 'failed') {
        await this.handleFailure(videoId, taskStatus);
      } else if (taskStatus.status === 'running' || taskStatus.status === 'queued') {
        // 更新为 processing 状态
        await this.updateStatus(videoId, 'processing');
      }

    } catch (error) {
      console.error(`[VideoPoller] 处理视频 ${videoId} 失败:`, error);
      // 不更新状态，下次轮询继续处理
    }
  }

  /**
   * 处理成功状态
   */
  private async handleSuccess(videoId: string, userId: string, taskStatus: any) {
    console.log(`[VideoPoller] 视频生成成功: ${videoId}`);

    try {
      // 1. 获取视频 URL
      const videoUrl = taskStatus.content?.video_url;
      if (!videoUrl) {
        throw new Error('Seedance 返回结果中没有 video_url');
      }

      // 2. 下载视频并存储到 TOS
      console.log(`[VideoPoller] 开始下载视频: ${videoUrl.substring(0, 50)}...`);
      const tosKey = await VideoStorageService.storeVideoFromUrl(
        userId,
        videoUrl,
        { taskId: videoId }
      );

      // 3. 设置公开读取权限
      await VideoStorageService.setPublicRead(tosKey);

      // 4. 获取公开永久 URL
      const publicVideoUrl = VideoStorageService.getVideoPublicUrl(tosKey);
      console.log(`[VideoPoller] 视频公开URL: ${publicVideoUrl}`);

      // 5. 更新数据库（使用实际存在的字段）
      await this.supabase
        .from('videos')
        .update({
          status: 'completed',
          tos_key: tosKey,
          result_url: publicVideoUrl,  // 使用 result_url 字段
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      // 6. 发送用户消息通知（方案二）
      const videoName = taskStatus.content?.video_name || taskStatus.extra_info?.prompt?.substring(0, 20) || '未命名';
      await this.sendUserNotification(userId, videoId, videoName, publicVideoUrl, 'completed');

      // 7. 调用回调 API 通知创意小海
      await this.notifyCallback(videoId, 'completed', publicVideoUrl);

      console.log(`[VideoPoller] 视频处理完成: ${videoId}`);

    } catch (error) {
      console.error(`[VideoPoller] 处理成功视频失败:`, error);
      // 如果上传失败，标记为 failed
      await this.handleFailure(videoId, {
        error: { message: error instanceof Error ? error.message : '上传到 TOS 失败' }
      });
    }
  }

  /**
   * 处理失败状态
   */
  private async handleFailure(videoId: string, taskStatus: any, video?: any) {
    console.log(`[VideoPoller] 视频生成失败: ${videoId}`);

    const errorReason = taskStatus.error?.message || '未知错误';

    // 更新数据库
    await this.supabase
      .from('videos')
      .update({
        status: 'failed',
        error_reason: errorReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);

    // 发送用户消息通知（方案二：失败通知）
    await this.sendUserNotification(
      video?.user_id || '', 
      videoId, 
      video?.video_name, 
      undefined, 
      'failed', 
      errorReason
    );

    // 调用回调 API 通知创意小海
    await this.notifyCallback(videoId, 'failed', undefined, errorReason);
  }

  /**
   * 更新视频状态
   */
  private async updateStatus(videoId: string, status: string) {
    await this.supabase
      .from('videos')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
  }

  /**
   * 发送用户消息通知（方案二：消息中心）
   */
  private async sendUserNotification(
    userId: string,
    videoId: string,
    videoName?: string,
    videoUrl?: string,
    status?: string,
    errorReason?: string
  ) {
    try {
      const isSuccess = status === 'completed';
      const title = isSuccess ? '视频生成完成' : '视频生成失败';
      const content = isSuccess
        ? `你的视频"${videoName || '未命名'}"已经生成完成，点击查看`
        : `你的视频"${videoName || '未命名'}"生成失败：${errorReason || '未知错误'}`;

      const notification = {
        user_id: userId,
        notification_type: isSuccess ? 'video_completed' : 'video_failed',
        title,
        content,
        related_video_id: videoId,
        related_video_name: videoName || null,
        related_video_url: videoUrl || null,
        action_url: `/material/history`,
      };

      const { data, error } = await this.supabase
        .from('user_notifications')
        .insert(notification)
        .select('id')
        .single();

      if (error) {
        console.error('[VideoPoller] 发送用户通知失败:', error);
      } else {
        console.log(`[VideoPoller] 发送用户通知成功: ${(data as any)?.id}`);
      }

    } catch (error) {
      console.error('[VideoPoller] 发送用户通知异常:', error);
      // 不影响主流程
    }
  }

  /**
   * 调用回调 API 通知创意小海 ⭐ 修复版
   * 直接调用创意小海的 API，把通知作为系统消息发给小海
   */
  private async notifyCallback(
    videoId: string,
    status: string,
    publicVideoUrl?: string,
    errorReason?: string
  ) {
    try {
      console.log(`[VideoPoller] 调用回调 API: ${videoId}, status=${status}`);

      // 1. 先从数据库查询 video_name 和 user_id
      const { data: videoData, error: queryError } = await this.supabase
        .from('videos')
        .select('video_name, user_id')
        .eq('id', videoId)
        .single();

      if (queryError || !videoData) {
        console.error('[VideoPoller] 查询视频信息失败:', queryError);
        return;
      }

      // 2. 构建通知内容（给创意小海的系统消息）
      const notificationMessage = `【系统通知】视频生成任务完成！

video_id: ${videoId}
video_name: ${videoData.video_name || '未命名'}
status: ${status}
${publicVideoUrl ? `public_video_url: ${publicVideoUrl}` : ''}
${errorReason ? `error_reason: ${errorReason}` : ''}
user_id: ${videoData.user_id}

请根据状态决定是否通知用户。`;

      console.log(`[VideoPoller] 通知内容:`, notificationMessage);

      // 3. TODO: 直接调用创意小海的 API，把这个通知作为系统消息发给小海
      // 暂时先记录日志，后续完善
      console.log(`[VideoPoller] 回调通知:`, { 
        videoId, 
        videoName: videoData.video_name,
        status, 
        publicVideoUrl, 
        errorReason,
        userId: videoData.user_id 
      });

    } catch (error) {
      console.error('[VideoPoller] 调用回调 API 失败:', error);
      // 不影响主流程
    }
  }
}

// 全局单例
let pollerInstance: VideoGenerationPoller | null = null;

export function getVideoPoller(): VideoGenerationPoller {
  // 开发环境下每次都返回新实例，确保代码更新生效
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.log('[VideoPoller] 开发环境，返回新实例');
    return new VideoGenerationPoller();
  }
  
  if (!pollerInstance) {
    pollerInstance = new VideoGenerationPoller();
  }
  return pollerInstance;
}
