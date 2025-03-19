import { addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';

// Mock user data
const mockUsers = [
  { email: 'sarah.chen@example.com', name: 'Sarah Chen', password: 'mockuser123' },
  { email: 'michael.rodriguez@example.com', name: 'Michael Rodriguez', password: 'mockuser123' },
  { email: 'emma.watson@example.com', name: 'Emma Watson', password: 'mockuser123' },
  { email: 'david.kim@example.com', name: 'David Kim', password: 'mockuser123' },
  { email: 'lisa.wang@example.com', name: 'Lisa Wang', password: 'mockuser123' },
  { email: 'john.doe@example.com', name: 'John Doe', password: 'mockuser123' },
  { email: 'jane.doe@example.com', name: 'Jane Doe', password: 'mockuser123' },
  { email: 'alice.smith@example.com', name: 'Alice Smith', password: 'mockuser123' },
  { email: 'bob.jones@example.com', name: 'Bob Jones', password: 'mockuser123' },
  { email: 'charlie.brown@example.com', name: 'Charlie Brown', password: 'mockuser123' }
];

// Mock comments for each post
const mockComments = [
  {
    content: "This is exactly what I needed! Could you share more details about the AI scheduling assistant you mentioned?",
    replies: [
      {
        content: "I use Calendar.ai - it's been a game changer for meeting scheduling. Happy to share my setup!"
      }
    ]
  },
  {
    content: "Thank you for sharing this! The gradual adoption approach really resonates with me.",
    replies: []
  },
  {
    content: "Great insights! How long did it take to see measurable improvements?",
    replies: [
      {
        content: "It took about 2-3 weeks to see the first improvements, and about 2 months to reach the 50% mark."
      }
    ]
  }
];

// Mock forum posts
const mockPosts = [
  {
    title: "How I leveraged AI to improve my productivity by 50%",
    content: "Over the past six months, I've integrated various AI tools into my daily workflow, and the results have been remarkable. Here's my detailed journey:\n\n1. Email Management: Using AI to categorize and draft responses has saved me 2 hours daily\n2. Meeting Summaries: AI transcription and summarization tools ensure I never miss key points\n3. Code Assistance: AI pair programming has accelerated my development speed\n4. Document Analysis: AI helps me extract insights from lengthy reports in minutes\n\nThe key was gradual integration and constant evaluation of what works best for my specific needs.",
    category: "Success Stories",
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "Dealing with AI anxiety in the workplace",
    content: "Many of us face anxiety about AI replacing our jobs. Here's how I transformed that fear into an opportunity for growth: 1) Identify AI-resistant skills, 2) Learn to collaborate with AI tools, 3) Focus on human-centric aspects of your role. Remember, AI is a tool to enhance our capabilities, not replace human creativity and emotional intelligence.",
    category: "Mental Health",
    image_url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80"
  }
];

export async function createMockData(db, auth) {
  try {
    console.log('Creating mock users...');
    const userCredentials = [];

    // Create mock users
    for (const user of mockUsers) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
        await updateProfile(userCredential.user, { displayName: user.name });
        console.log(`Created user: ${user.email}`);
        userCredentials.push(userCredential);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`User already exists: ${user.email}`);
          const userCredential = await signInWithEmailAndPassword(auth, user.email, user.password);
          userCredentials.push(userCredential);
        } else {
          throw error;
        }
      }
    }

    console.log('Creating mock posts...');
    // Create mock posts
    for (let i = 0; i < mockPosts.length; i++) {
      const post = mockPosts[i];
      const userCredential = userCredentials[i % userCredentials.length];

      // Check if post exists
      const q = query(collection(db, 'posts'), where('title', '==', post.title));
      const querySnapshot = await getDocs(q);

      let postRef;
      if (!querySnapshot.empty) {
        // Update existing post
        postRef = doc(db, 'posts', querySnapshot.docs[0].id);
        await updateDoc(postRef, {
          ...post,
          userId: userCredential.user.uid,
          user_name: userCredential.user.displayName,
          likes_count: 0,
          comments_count: 0,
          updatedAt: serverTimestamp()
        });
        console.log(`Updated post: ${post.title}`);
      } else {
        // Create new post
        postRef = await addDoc(collection(db, 'posts'), {
          ...post,
          userId: userCredential.user.uid,
          user_name: userCredential.user.displayName,
          likes_count: 0,
          comments_count: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log(`Created post: ${post.title}`);
      }

      // Add likes to post
      const numLikes = Math.floor(Math.random() * 20) + 5; // 5-25 likes per post
      for (let j = 0; j < numLikes; j++) {
        const likerCredential = userCredentials[Math.floor(Math.random() * userCredentials.length)];
        await addDoc(collection(db, 'posts', postRef.id, 'likes'), {
          userId: likerCredential.user.uid,
          user_name: likerCredential.user.displayName,
          createdAt: serverTimestamp()
        });
      }

      // Update post likes count
      await updateDoc(doc(db, 'posts', postRef.id), {
        likes_count: numLikes
      });

      // Add comments to post
      let totalComments = 0;
      for (const comment of mockComments) {
        const commenterCredential = userCredentials[Math.floor(Math.random() * userCredentials.length)];
        const commentRef = await addDoc(collection(db, 'posts', postRef.id, 'comments'), {
          content: comment.content,
          userId: commenterCredential.user.uid,
          user_name: commenterCredential.user.displayName,
          likes_count: 0,
          createdAt: serverTimestamp()
        });
        totalComments++;

        // Add likes to comment
        const numCommentLikes = Math.floor(Math.random() * 10) + 1; // 1-10 likes per comment
        for (let k = 0; k < numCommentLikes; k++) {
          const likerCredential = userCredentials[Math.floor(Math.random() * userCredentials.length)];
          await addDoc(collection(db, 'posts', postRef.id, 'comments', commentRef.id, 'likes'), {
            userId: likerCredential.user.uid,
            user_name: likerCredential.user.displayName,
            createdAt: serverTimestamp()
          });
        }

        // Update comment likes count
        await updateDoc(commentRef, {
          likes_count: numCommentLikes
        });

        // Add replies to comment
        for (const reply of comment.replies) {
          const replierCredential = userCredentials[Math.floor(Math.random() * userCredentials.length)];
          const replyRef = await addDoc(
            collection(db, 'posts', postRef.id, 'comments', commentRef.id, 'replies'),
            {
              content: reply.content,
              userId: replierCredential.user.uid,
              user_name: replierCredential.user.displayName,
              likes_count: 0,
              createdAt: serverTimestamp()
            }
          );
          totalComments++;

          // Add likes to reply
          const numReplyLikes = Math.floor(Math.random() * 5) + 1; // 1-5 likes per reply
          for (let l = 0; l < numReplyLikes; l++) {
            const likerCredential = userCredentials[Math.floor(Math.random() * userCredentials.length)];
            await addDoc(
              collection(db, 'posts', postRef.id, 'comments', commentRef.id, 'replies', replyRef.id, 'likes'),
              {
                userId: likerCredential.user.uid,
                user_name: likerCredential.user.displayName,
                createdAt: serverTimestamp()
              }
            );
          }

          // Update reply likes count
          await updateDoc(replyRef, {
            likes_count: numReplyLikes
          });
        }
      }

      // Update post comments count
      await updateDoc(doc(db, 'posts', postRef.id), {
        comments_count: totalComments
      });
    }

    console.log('Mock data created successfully!');
  } catch (error) {
    console.error('Error creating mock data:', error);
    throw error;
  }
}