import React, { createContext, useContext, useState } from 'react';

export type Reply = {
  id: number;
  author: string;
  content: string;
  timestamp: string;
  likes: number;
};

export type Comment = {
  id: number;
  author: string;
  content: string;
  timestamp: string;
  likes: number;
  replies: Reply[];
};

export type Post = {
  id: number;
  title: string;
  author: string;
  content: string;
  likes: number;
  comments: Comment[];
  timeAgo: string;
  category: string;
  imageUrl?: string;
  videoUrl?: string;
};

type PostContextType = {
  posts: Post[];
  addComment: (postId: number, comment: Omit<Comment, 'id' | 'replies'>) => void;
  addReply: (postId: number, commentId: number, reply: Omit<Reply, 'id'>) => void;
};

const PostContext = createContext<PostContextType | undefined>(undefined);

export const initialPosts: Post[] = [
  {
    id: 1,
    title: "How I leveraged AI to improve my productivity by 50%",
    author: "Sarah Chen",
    content: "I started using AI tools for task automation and the results have been incredible. Here's my detailed journey and the specific tools that made the biggest impact...",
    likes: 24,
    comments: [
      {
        id: 1,
        author: "David Kim",
        content: "This is exactly what I needed! Could you share more details about the AI scheduling assistant you mentioned?",
        timestamp: "1h ago",
        likes: 5,
        replies: [
          {
            id: 1,
            author: "Sarah Chen",
            content: "Of course! I use Calendar.ai - it's been a game changer for meeting scheduling.",
            timestamp: "45m ago",
            likes: 2
          }
        ]
      }
    ],
    timeAgo: "2h ago",
    category: "Success Stories",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 2,
    title: "Dealing with AI anxiety in the workplace",
    author: "Michael Rodriguez",
    content: "Here's how I overcame my initial fears about AI tools at work and helped my team embrace the change...",
    likes: 15,
    comments: [
      {
        id: 2,
        author: "Lisa Wang",
        content: "Thank you for sharing this! The gradual adoption approach really resonates with me.",
        timestamp: "3h ago",
        likes: 3,
        replies: []
      }
    ],
    timeAgo: "5h ago",
    category: "Discussion",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  }
];

export const PostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  const addComment = (postId: number, comment: Omit<Comment, 'id' | 'replies'>) => {
    setPosts(currentPosts => 
      currentPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [
              ...post.comments,
              {
                ...comment,
                id: Math.max(0, ...post.comments.map(c => c.id)) + 1,
                replies: []
              }
            ]
          };
        }
        return post;
      })
    );
  };

  const addReply = (postId: number, commentId: number, reply: Omit<Reply, 'id'>) => {
    setPosts(currentPosts =>
      currentPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map(comment => {
              if (comment.id === commentId) {
                return {
                  ...comment,
                  replies: [
                    ...comment.replies,
                    {
                      ...reply,
                      id: Math.max(0, ...comment.replies.map(r => r.id)) + 1
                    }
                  ]
                };
              }
              return comment;
            })
          };
        }
        return post;
      })
    );
  };

  return (
    <PostContext.Provider value={{ posts, addComment, addReply }}>
      {children}
    </PostContext.Provider>
  );
};

export const usePosts = () => {
  const context = useContext(PostContext);
  if (context === undefined) {
    throw new Error('usePosts must be used within a PostProvider');
  }
  return context;
};