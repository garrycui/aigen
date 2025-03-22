import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  MessageSquare, ThumbsUp, ArrowLeft, Edit, Trash2, Reply 
} from 'lucide-react';
import { 
  fetchPost, createComment, createReply, toggleLike,
  updatePost, deletePost, updateComment, deleteComment,
  updateReply, deleteReply, formatDate, handleCommentLike, handleReplyLike,
  PostData, CommentData, ReplyData, optimisticLikeToggle, optimisticCommentDelete
} from '@shared/lib/post/post';
import { useAuth } from '@context/AuthContext';
import ReactMarkdown from 'react-markdown';
import EditPostModal from '@components/post/EditPostModal';
import DeleteConfirmationModal from '@components/post/DeleteConfirmationModal';
import EditCommentModal from '@components/post/EditCommentModal';

interface ReplyingTo {
  commentId: string;
}

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostData & { comments: CommentData[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [replyContent, setReplyContent] = useState<string>("");
  const { user } = useAuth();
  const navigate = useNavigate();

  // Edit/Delete state
  const [isEditPostModalOpen, setIsEditPostModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'post' | 'comment' | 'reply'>('post');
  const [deleteItemId, setDeleteItemId] = useState<string>('');
  const [deleteCommentId, setDeleteCommentId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditCommentModalOpen, setIsEditCommentModalOpen] = useState(false);
  const [editingComment, setEditingComment] = useState<{
    id: string;
    content: string;
    type: 'comment' | 'reply';
    commentId?: string;
  } | null>(null);

  const handleLike = async (type: 'post' | 'comment' | 'reply', itemId: string, commentId?: string) => {
    if (!user || !post) {
      navigate('/login');
      return;
    }

    try {
      if (type === 'post') {
        // Use shared optimistic like toggle function
        await optimisticLikeToggle(
          post,
          (updatedPost) => setPost(updatedPost),
          () => toggleLike(type, itemId, user.id)
        );
      } else if (type === 'comment') {
        await handleCommentLike(post.id, itemId, user.id, post, setPost);
      } else if (type === 'reply' && commentId) {
        await handleReplyLike(post.id, commentId, itemId, user.id, post, setPost);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const loadPost = async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      const response = await fetchPost(id);
      setPost(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load post. Please try again later.');
      console.error('Error loading post:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPost();
  }, [id]);

  const handleComment = async () => {
    if (!user || !post || !newComment.trim()) {
      return;
    }

    try {
      await createComment(post.id, user.id, user.name, newComment);
      setNewComment('');
      loadPost();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    }
  };

  const handleReply = async (commentId: string) => {
    if (!user || !post || !replyContent.trim()) {
      return;
    }

    try {
      await createReply(post.id, commentId, user.id, user.name, replyContent);
      setReplyContent('');
      setReplyingTo(null);
      loadPost();
    } catch (error) {
      console.error('Error posting reply:', error);
      alert('Failed to post reply. Please try again.');
    }
  };

  const handleEditPost = async (updates: { title: string; content: string; category: string }) => {
    if (!user || !post) return;
    try {
      await updatePost(post.id, user.id, updates);
      await loadPost();
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  };

  const handleDeletePost = async () => {
    if (!user || !post) return;
    try {
      setIsDeleting(true);
      await deletePost(post.id, user.id);
      navigate('/forum');
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditComment = async (content: string) => {
    if (!user || !post || !editingComment) return;
    try {
      if (editingComment.type === 'comment') {
        await updateComment(post.id, editingComment.id, user.id, content);
      } else {
        if (!editingComment.commentId) return;
        await updateReply(post.id, editingComment.commentId, editingComment.id, user.id, content);
      }
      await loadPost();
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  };

  const handleDeleteComment = async () => {
    if (!user || !post || !deleteItemId) return;
    try {
      setIsDeleting(true);
      
      if (deleteType === 'comment') {
        // Use shared optimistic comment delete function
        await optimisticCommentDelete(
          post.id, 
          deleteItemId, 
          user.id, 
          post, 
          setPost
        );
      } else {
        if (!deleteCommentId) return;
        await deleteReply(post.id, deleteCommentId, deleteItemId, user.id);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      // On error, reload the post to ensure correct state
      await loadPost();
      throw error;
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">
          {error || 'Post not found'}
        </h2>
        <Link to="/forum" className="text-indigo-600 hover:text-indigo-800 mt-4 inline-block">
          Return to Forum
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link 
        to="/forum"
        className="inline-flex items-center text-indigo-600 hover:text-indigo-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Forum
      </Link>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          {/* Post Header & Content */}
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">{post.title}</h1>
            {user && user.id === post.userId && (
              <div className="flex space-x-2">
                <button 
                  onClick={() => setIsEditPostModalOpen(true)}
                  className="p-2 text-gray-500 hover:text-indigo-600 rounded"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    setDeleteType('post');
                    setDeleteItemId(post.id);
                    setIsDeleteModalOpen(true);
                  }}
                  className="p-2 text-gray-500 hover:text-red-600 rounded"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {post.image_url && (
            <div className="mb-6">
              <img
                src={post.image_url}
                alt="Post illustration"
                className="w-full h-96 object-cover rounded-lg"
              />
            </div>
          )}

          <div className="prose prose-indigo mb-6">
            <ReactMarkdown>
              {post.content}
            </ReactMarkdown>
          </div>

          {post.video_url && (
            <div className="w-full h-96 mb-6">
              <iframe
                src={post.video_url}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-lg"
              ></iframe>
            </div>
          )}
          
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleLike('post', post.id)}
                className={`flex items-center space-x-1 ${
                  post.is_liked
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                <ThumbsUp className={`h-5 w-5 ${post.is_liked ? 'fill-current' : ''}`} />
                <span>{post.likes_count}</span>
              </button>
              <div className="flex items-center space-x-1 text-gray-500">
                <MessageSquare className="h-5 w-5" />
                <span>{post.comments_count}</span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Posted by <span className="font-medium">{post.user_name}</span>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-gray-50 p-6">
          <h3 className="font-medium text-gray-900 mb-4">Comments</h3>
          <div className="space-y-4">
            {post.comments?.map((comment: CommentData) => (
              <CommentSection
                key={comment.id}
                comment={comment}
                postId={post.id}
                currentUserId={user?.id}
                onReply={(commentId) => {
                  setReplyingTo({ commentId });
                  setReplyContent('');
                }}
                onEdit={(comment, type, commentId) => {
                  setEditingComment({
                    id: comment.id,
                    content: comment.content,
                    type,
                    commentId
                  });
                  setIsEditCommentModalOpen(true);
                }}
                onDelete={(itemId, type, commentId) => {
                  setDeleteType(type);
                  setDeleteItemId(itemId);
                  setDeleteCommentId(commentId || '');
                  setIsDeleteModalOpen(true);
                }}
                replyingTo={replyingTo}
                replyContent={replyContent}
                setReplyContent={setReplyContent}
                handleReply={handleReply}
                handleLike={handleLike}
                formatDate={formatDate}
              />
            ))}
          </div>

          <div className="mt-6">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleComment}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                disabled={!newComment.trim()}
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditPostModal
        isOpen={isEditPostModalOpen}
        onClose={() => setIsEditPostModalOpen(false)}
        onSave={handleEditPost}
        initialData={{
          title: post?.title || '',
          content: post?.content || '',
          category: post?.category || ''
        }}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={deleteType === 'post' ? handleDeletePost : handleDeleteComment}
        type={deleteType}
        isDeleting={isDeleting}
      />

      <EditCommentModal
        isOpen={isEditCommentModalOpen}
        onClose={() => {
          setIsEditCommentModalOpen(false);
          setEditingComment(null);
        }}
        onSave={handleEditComment}
        initialContent={editingComment?.content || ''}
        type={editingComment?.type || 'comment'}
      />
    </div>
  );
};

interface CommentSectionProps {
  comment: CommentData;
  postId: string;
  currentUserId?: string;
  onReply: (commentId: string) => void;
  onEdit: (item: { id: string; content: string }, type: 'comment' | 'reply', commentId?: string) => void;
  onDelete: (itemId: string, type: 'comment' | 'reply', commentId?: string) => void;
  replyingTo: ReplyingTo | null;
  replyContent: string;
  setReplyContent: React.Dispatch<React.SetStateAction<string>>;
  handleReply: (commentId: string) => Promise<void>;
  handleLike: (type: 'post' | 'comment' | 'reply', itemId: string, commentId?: string) => Promise<void>;
  formatDate: (timestamp: any) => string;
}

const CommentSection: React.FC<CommentSectionProps> = ({
  comment,
  postId,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  replyingTo,
  replyContent,
  setReplyContent,
  handleReply,
  handleLike,
  formatDate
}) => (
  <div className="border-l-2 border-gray-200 pl-4">
    <div className="bg-white p-4 rounded-lg">
      <div className="flex justify-between mb-2">
        <span className="font-medium text-gray-900">{comment.user_name}</span>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {formatDate(comment.created_at)}
          </span>
          {currentUserId === comment.userId && (
            <div className="flex space-x-1">
              <button
                onClick={() => onEdit(comment, 'comment')}
                className="p-1 text-gray-500 hover:text-indigo-600 rounded"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(comment.id, 'comment')}
                className="p-1 text-gray-500 hover:text-red-600 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-gray-600 mb-2">{comment.content}</p>
      <div className="flex items-center space-x-4">
        <button
          onClick={() => handleLike('comment', comment.id)}
          className={`text-sm ${
            comment.is_liked
              ? 'text-indigo-600'
              : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          <ThumbsUp
            className={`h-4 w-4 inline mr-1 ${
              comment.is_liked ? 'fill-current' : ''
            }`}
          />
          {comment.likes_count}
        </button>
        <button
          onClick={() => onReply(comment.id)}
          className="text-sm text-gray-500 hover:text-indigo-600"
        >
          <Reply className="h-4 w-4 inline mr-1" />
          Reply
        </button>
      </div>

      {replyingTo?.commentId === comment.id && (
        <div className="mt-2">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply..."
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows={2}
          />
          <div className="flex justify-end space-x-2 mt-2">
            <button
              onClick={() => onReply('')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => handleReply(comment.id)}
              className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
              disabled={!replyContent.trim()}
            >
              Reply
            </button>
          </div>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-4 mt-2 space-y-2">
          {comment.replies.map((reply: ReplyData) => (
            <div key={reply.id} className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between mb-1">
                <span className="font-medium text-gray-900">{reply.user_name}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {formatDate(reply.created_at)}
                  </span>
                  {currentUserId === reply.userId && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => onEdit(reply, 'reply', comment.id)}
                        className="p-1 text-gray-500 hover:text-indigo-600 rounded"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(reply.id, 'reply', comment.id)}
                        className="p-1 text-gray-500 hover:text-red-600 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-gray-600">{reply.content}</p>
              <button
                onClick={() => handleLike('reply', reply.id, comment.id)}
                className={`text-sm mt-1 ${
                  reply.is_liked
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                <ThumbsUp
                  className={`h-4 w-4 inline mr-1 ${
                    reply.is_liked ? 'fill-current' : ''
                  }`}
                />
                {reply.likes_count}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default PostDetail;