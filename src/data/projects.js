/**
 * Projects Data & Utilities
 * Contains strictly the 3 featured portfolio projects:
 * 1. Portfolio Website
 * 2. Food Delivery App
 * 3. Sign Language Detection using Deep Learning
 */

export const projects = [
  {
    id: 'portfolio',
    title: 'Portfolio Website',
    description:
      'A personal portfolio website to showcase my projects, skills, and experience with a modern and responsive design.',
    image: '/images/My_portfolio.png',
    tech: ['HTML', 'CSS3', 'JavaScript', 'Responsive Design', 'React'],
    tags: ['React', 'Frontend', 'JavaScript'],
    category: 'Frontend & UI Engineering',
    githubUrl: 'https://github.com/Sachin2501/Sachin_portfolio_website.io.git',
    liveUrl: 'https://sachin2501.github.io/portfolio_website.io/',
    seo: {
      metaTitle: 'Portfolio Website – HTML, CSS3, JavaScript | Sachin Kumar',
      metaDescription:
        'Portfolio Website: A personal portfolio website to showcase my projects, skills, and experience with a modern and responsive design. Built by Sachin Kumar.',
      keywords:
        'Portfolio Website, Frontend & UI Engineering, HTML, CSS3, JavaScript, Responsive Design, React, Sachin Kumar, Software Engineer Portfolio, Full Stack Developer',
      canonicalUrl: 'https://sachinkumar.dev/#projects',
      ogImage: '/images/My_portfolio.png',
      twitterCard: 'summary_large_image',
      robots: 'index, follow',
      schemaType: 'WebApplication',
      author: 'Sachin Kumar',
      updatedAt: '2026-11-13T09:15:00.000Z',
    },
  },
  {
    id: 'food-delivery',
    title: 'Food Delivery App',
    description:
      'Full-stack food delivery platform with live order tracking, multiple payment options, and efficient delivery management system.',
    image: '/images/Food_Delivery_App.png',
    tech: ['MongoDB', 'React', 'Express', 'JavaScript', 'Node.js', 'MERN'],
    tags: ['React', 'Backend', 'Full Stack', 'JavaScript'],
    category: 'Full Stack & MERN Architecture',
    githubUrl: 'https://github.com/Sachin2501/Food_app_Client_frontend.git',
    liveUrl: 'https://food-app-client-frontend.vercel.app/',
    seo: {
      metaTitle: 'Food Delivery App – MongoDB, React, Express | Sachin Kumar',
      metaDescription:
        'Food Delivery App: Full-stack food delivery platform with live order tracking, multiple payment options, and efficient delivery management system.',
      keywords:
        'Food Delivery App, Full Stack & MERN Architecture, MongoDB, React, Express, JavaScript, Node.js, MERN, Sachin Kumar, Software Engineer Portfolio',
      canonicalUrl: 'https://sachinkumar.dev/#projects',
      ogImage: '/images/Food_Delivery_App.png',
      twitterCard: 'summary_large_image',
      robots: 'index, follow',
      schemaType: 'WebApplication',
      author: 'Sachin Kumar',
      updatedAt: '2026-11-13T09:15:00.000Z',
    },
  },
  {
    id: 'sign-language',
    title: 'Sign Language Detection using Deep Learning',
    description:
      'Real-time sign language detection system using deep learning to convert hand gestures into text with high accuracy.',
    image: '/images/Deep_Learning.jpg',
    tech: [
      'AI/ML',
      'Python',
      'Deep Learning',
      'TensorFlow',
      'OpenCV',
      'NumPy',
    ],
    tags: ['Machine Learning', 'Python', 'AI/ML'],
    category: 'Computer Vision & AI/ML',
    githubUrl:
      'https://github.com/Sachin2501/Sign_Language_Detection_DeepLearning_Project.git',
    liveUrl:
      'https://www.linkedin.com/in/sachin-kumar-sharma2501/details/projects/526323928/multiple-media-viewer?profileId=ACoAAFExRwEBBj88OgurA3PVc3CGPo-ywb60RLg&treasuryMediaId=1746430531629&type=DOCUMENT&lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base_projects_details%3BstDBS%2FN0TjiLUAa9L7DB3Q%3D%3D',
    seo: {
      metaTitle: 'Sign Language Detection using Deep Learning | Sachin Kumar',
      metaDescription:
        'Sign Language Detection using Deep Learning: Real-time sign language detection system using deep learning to convert hand gestures into text with high accuracy.',
      keywords:
        'Sign Language Detection using Deep Learning, Computer Vision & AI/ML, AI/ML, Python, Deep Learning, TensorFlow, OpenCV, NumPy, Sachin Kumar',
      canonicalUrl: 'https://sachinkumar.dev/#projects',
      ogImage: '/images/Deep_Learning.jpg',
      twitterCard: 'summary_large_image',
      robots: 'index, follow',
      schemaType: 'SoftwareApplication',
      author: 'Sachin Kumar',
      updatedAt: '2026-11-13T09:15:00.000Z',
    },
  },
];

/**
 * Filter projects by tag
 */
export function filterProjectsByTag(tag) {
  if (!tag || tag === 'All') return projects;
  const tagLower = tag.toLowerCase();

  return projects.filter((project) => {
    // Check tags array
    if (project.tags && project.tags.some((t) => t.toLowerCase() === tagLower)) {
      return true;
    }
    // Check tech array
    if (project.tech && project.tech.some((t) => t.toLowerCase() === tagLower)) {
      return true;
    }
    // Check category string
    if (project.category && project.category.toLowerCase().includes(tagLower)) {
      return true;
    }
    return false;
  });
}

/**
 * Find project by ID
 */
export function getProjectById(projectId) {
  return projects.find((project) => project.id === projectId) || null;
}
