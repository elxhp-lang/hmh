export interface VideoLibraryItem {
  id: string;
  user_id: string;
  session_id?: string | null;
  task_id?: string;
  video_id?: string;
  seedance_task_id?: string;
  video_name?: string;
  prompt: string;
  script?: string;
  copywriting?: string;
  tags?: string[];
  tag_source?: string | null;
  auto_tag_status?: string | null;
  category?: string;
  reference_images?: string[];
  generate_audio?: boolean;
  watermark?: boolean;
  web_search?: boolean;
  source_video_id?: string;
  source_task_id?: string;
  is_remix?: boolean;
  task_type: string;
  status: string;
  tos_key: string | null;
  video_url: string | null;
  public_video_url?: string | null;
  result_url?: string | null;
  ratio: string;
  duration: number;
  cost: number | null;
  error_message: string | null;
  error_reason?: string;
  created_at: string;
  model?: string;
  source?: 'videos' | 'learning_library';
  users: {
    id: string;
    username: string;
    email: string;
    role: string;
  } | null;
}

export interface VideoLibraryResponse {
  success: boolean;
  videos: VideoLibraryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filter?: {
    type: string;
    status: string | null;
    version?: string;
    userIds: string[];
  };
}
