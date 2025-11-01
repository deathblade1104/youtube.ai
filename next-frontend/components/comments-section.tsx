'use client';

import { commentAPI } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Comment {
  id: number;
  video_id: number;
  user_id: number;
  user_name?: string | null;
  content: string;
  parent_id: number | null;
  likes: number;
  has_liked?: boolean;
  is_edited: boolean;
  created_at: string;
  updated_at: string | null;
  replies?: Comment[];
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

interface CommentsSectionProps {
  videoId: number;
}

export function CommentsSection({ videoId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState<Record<number, string>>({});
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const data = await commentAPI.list(videoId, 1, 50);
      // Map comments to ensure user_name is populated from user relation and has_liked is included
      const mappedComments = (data.items || []).map((comment: any) => ({
        ...comment,
        user_name: comment.user_name || comment.user?.name || 'Unknown User',
        has_liked: comment.has_liked ?? false, // Ensure has_liked is boolean
        replies: (comment.replies || []).map((reply: any) => ({
          ...reply,
          user_name: reply.user_name || reply.user?.name || 'Unknown User',
          has_liked: reply.has_liked ?? false, // Ensure has_liked is boolean for replies
        })),
      }));
      setComments(mappedComments);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await commentAPI.create(videoId, {
        content: newComment.trim(),
        parent_id: null,
      });
      setNewComment('');
      fetchComments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to post comment');
    }
  };

  const handleReply = async (parentId: number) => {
    const content = replyContent[parentId];
    if (!content?.trim()) return;

    try {
      await commentAPI.create(videoId, {
        content: content.trim(),
        parent_id: parentId,
      });
      setReplyContent(prev => ({ ...prev, [parentId]: '' }));
      setReplyingTo(null);
      fetchComments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to post reply');
    }
  };

  const handleLike = async (commentId: number) => {
    try {
      // Prevent double-clicks
      const comment = comments.find(
        c => c.id === commentId || c.replies?.some(r => r.id === commentId),
      );
      if (!comment) return;

      const response = await commentAPI.like(videoId, commentId);
      // Response structure: { comment_id, likes, has_liked } (after API extraction)
      const newLikesCount = response?.likes ?? 0;
      const newHasLiked = response?.has_liked ?? false;

      // Validate response
      if (
        typeof newLikesCount !== 'number' ||
        typeof newHasLiked !== 'boolean'
      ) {
        console.error('Invalid like response:', response);
        fetchComments(); // Refetch on invalid response
        return;
      }

      // Update the UI with the actual response from backend
      setComments(prevComments =>
        prevComments.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              likes: newLikesCount,
              has_liked: newHasLiked,
            };
          }
          // Also update if it's in replies
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map(reply =>
                reply.id === commentId
                  ? {
                      ...reply,
                      likes: newLikesCount,
                      has_liked: newHasLiked,
                    }
                  : reply,
              ),
            };
          }
          return comment;
        }),
      );
    } catch (err: any) {
      console.error('Failed to like comment:', err);
      // Refetch on error to get correct state
      fetchComments();
    }
  };

  const handleEdit = async (commentId: number) => {
    const content = editContent[commentId];
    if (!content?.trim()) return;

    try {
      await commentAPI.update(videoId, commentId, { content: content.trim() });
      setEditContent(prev => ({ ...prev, [commentId]: '' }));
      setEditingComment(null);
      fetchComments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update comment');
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await commentAPI.delete(videoId, commentId);
      fetchComments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete comment');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const renderComment = (comment: Comment, depth = 0) => {
    const isEditing = editingComment === comment.id;
    const isReplying = replyingTo === comment.id;

    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-4' : ''}`}>
        <div className='flex space-x-3'>
          <div className='flex-shrink-0'>
            <div className='w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center'>
              <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                {comment.user_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
          </div>
          <div className='flex-1 min-w-0'>
            <div className='bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3'>
              <div className='flex items-start justify-between mb-1'>
                <div>
                  <span className='text-sm font-medium text-gray-900 dark:text-white'>
                    {comment.user_name || 'Unknown User'}
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400 ml-2'>
                    {formatDate(comment.created_at)}
                    {comment.is_edited && (
                      <span className='ml-1 italic'>(edited)</span>
                    )}
                  </span>
                </div>
              </div>
              {isEditing ? (
                <div className='space-y-2'>
                  <textarea
                    value={editContent[comment.id] || comment.content}
                    onChange={e =>
                      setEditContent(prev => ({
                        ...prev,
                        [comment.id]: e.target.value,
                      }))
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm'
                    rows={3}
                  />
                  <div className='flex space-x-2'>
                    <button
                      onClick={() => handleEdit(comment.id)}
                      className='px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors'
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingComment(null);
                        setEditContent(prev => ({ ...prev, [comment.id]: '' }));
                      }}
                      className='px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md transition-colors'
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className='text-sm text-gray-900 dark:text-white whitespace-pre-wrap mb-2'>
                    {comment.content}
                  </p>
                  <div className='flex items-center space-x-4'>
                    <button
                      onClick={() => handleLike(comment.id)}
                      className={`flex items-center space-x-1 text-xs transition-colors ${
                        comment.has_liked
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                      }`}
                    >
                      <svg
                        className='w-4 h-4'
                        fill={comment.has_liked ? 'currentColor' : 'none'}
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5'
                        />
                      </svg>
                      <span>{comment.likes}</span>
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo(comment.id);
                        setReplyContent(prev => ({
                          ...prev,
                          [comment.id]: '',
                        }));
                      }}
                      className='text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors'
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className='text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-500 transition-colors'
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        setEditingComment(comment.id);
                        setEditContent(prev => ({
                          ...prev,
                          [comment.id]: comment.content,
                        }));
                      }}
                      className='text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors'
                    >
                      Edit
                    </button>
                  </div>
                </>
              )}
            </div>
            {isReplying && (
              <div className='mt-2 space-y-2'>
                <textarea
                  value={replyContent[comment.id] || ''}
                  onChange={e =>
                    setReplyContent(prev => ({
                      ...prev,
                      [comment.id]: e.target.value,
                    }))
                  }
                  placeholder='Write a reply...'
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm'
                  rows={2}
                />
                <div className='flex space-x-2'>
                  <button
                    onClick={() => handleReply(comment.id)}
                    className='px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors'
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyContent(prev => ({ ...prev, [comment.id]: '' }));
                    }}
                    className='px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md transition-colors'
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {comment.replies && comment.replies.length > 0 && (
              <div className='mt-2'>
                {comment.replies.map(reply => renderComment(reply, depth + 1))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className='p-4 text-center text-gray-600 dark:text-gray-400'>
        Loading comments...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-xl font-semibold text-gray-900 dark:text-white mb-4'>
          Comments ({comments.length})
        </h2>

        {/* Add Comment Form */}
        <form onSubmit={handleSubmitComment} className='mb-6'>
          <div className='flex space-x-3'>
            <div className='flex-shrink-0'>
              <div className='w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center'>
                <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  U
                </span>
              </div>
            </div>
            <div className='flex-1'>
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder='Add a comment...'
                className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                rows={3}
              />
              <div className='mt-2 flex justify-end'>
                <button
                  type='submit'
                  disabled={!newComment.trim()}
                  className='px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors'
                >
                  Comment
                </button>
              </div>
            </div>
          </div>
        </form>

        {error && (
          <div className='mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400 text-sm'>
            {error}
          </div>
        )}

        {/* Comments List */}
        <div className='space-y-4'>
          {comments.length === 0 ? (
            <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
              No comments yet. Be the first to comment!
            </div>
          ) : (
            comments.map(comment => renderComment(comment))
          )}
        </div>
      </div>
    </div>
  );
}
