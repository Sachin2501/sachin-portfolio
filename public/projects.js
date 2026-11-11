/**
 * Sachin Kumar Portfolio - Projects Data Module
 * https://github.com/Sachin2501
 */

window.PORTFOLIO_PROJECTS = [
  {
    id: "portfolio",
    title: "Portfolio Website",
    category: "Frontend / Web",
    description: "A personal portfolio website to showcase my projects, skills, and experience with a modern and responsive design.",
    tech: ["HTML", "CSS3", "JavaScript", "Responsive Design"],
    githubUrl: "https://github.com/Sachin2501/Sachin_portfolio_website.io.git",
    liveUrl: "https://sachin2501.github.io/portfolio_website.io/",
    image: "/images/My_portfolio.png"
  },
  {
    id: "food-delivery",
    title: "Food Delivery App",
    category: "Full Stack / MERN",
    description: "Full-stack food delivery platform with live order tracking, multiple payment options, and efficient delivery management system.",
    tech: ["MongoDB", "React", "Express", "JavaScript", "Node.js", "MERN"],
    githubUrl: "https://github.com/Sachin2501/Food_app_Client_frontend.git",
    liveUrl: "https://food-app-client-frontend.vercel.app/",
    image: "/images/Food_Delivery_App.png"
  },
  {
    id: "sign-language",
    title: "Sign Language Detection using Deep Learning",
    category: "Computer Vision & AI",
    description: "Real-time sign language detection system using deep learning to convert hand gestures into text with high accuracy.",
    tech: ["AI/ML", "Python", "Deep Learning", "TensorFlow", "OpenCV", "NumPy"],
    githubUrl: "https://github.com/Sachin2501/Sign_Language_Detection_DeepLearning_Project.git",
    liveUrl: "https://www.linkedin.com/in/sachin-kumar-sharma2501/details/projects/526323928/multiple-media-viewer?profileId=ACoAAFExRwEBBj88OgurA3PVc3CGPo-ywb60RLg&treasuryMediaId=1746430531629&type=DOCUMENT&lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base_projects_details%3BstDBS%2FN0TjiLUAa9L7DB3Q%3D%3D",
    image: "/images/Deep_Learning.jpg"
  }
];

console.log("Portfolio projects loaded successfully from projects.js:", window.PORTFOLIO_PROJECTS.length, "items.");
