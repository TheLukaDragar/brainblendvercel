export const isProductionEnvironment = process.env.NODE_ENV === 'production';

export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT,
);

export const EXPERTISE_TAGS = {
  technology: [
    'Web Development',
    'Mobile Development',
    'Machine Learning',
    'Data Science',
    'Cybersecurity',
    'DevOps',
    'Cloud Computing',
    'Blockchain',
    'UX/UI Design',
    'Game Development',
    'AR/VR',
    'IoT',
    'Database Administration',
    'Network Engineering',
  ],
  business: [
    'Marketing',
    'Finance',
    'Entrepreneurship',
    'Project Management',
    'Human Resources',
    'Sales',
    'Product Management',
    'Business Strategy',
    'Supply Chain',
    'E-commerce',
    'Consulting',
  ],
  healthcare: [
    'Medicine',
    'Nursing',
    'Pharmacy',
    'Public Health',
    'Mental Health',
    'Nutrition',
    'Physical Therapy',
    'Biotechnology',
    'Healthcare Administration',
  ],
  science: [
    'Physics',
    'Chemistry',
    'Biology',
    'Astronomy',
    'Environmental Science',
    'Mathematics',
    'Statistics',
    'Research Methodology',
    'Neuroscience',
  ],
  creative: [
    'Graphic Design',
    'Content Creation',
    'Video Production',
    'Photography',
    'Illustration',
    'Animation',
    'Creative Writing',
    'Music Production',
    'Filmmaking',
  ],
  education: [
    'Teaching',
    'Curriculum Development',
    'Educational Technology',
    'E-learning',
    'Language Teaching',
    'Academic Research',
    'Special Education',
  ],
  legal: [
    'Law',
    'Intellectual Property',
    'Contracts',
    'Corporate Law',
    'International Law',
    'Compliance',
  ],
  other: [
    'Agriculture',
    'Architecture',
    'Construction',
    'Culinary Arts',
    'Fashion',
    'Journalism',
    'Languages',
    'Philosophy',
    'Psychology',
    'Social Work',
    'Sports & Fitness',
    'Translation',
    'Travel & Tourism',
  ]
};

// Flattened list for easier access
export const ALL_EXPERTISE_TAGS = Object.values(EXPERTISE_TAGS).flat();

// Function to extract expertise tags from user input
export function extractExpertiseTags(input: string): string[] {
  if (!input) return [];
  
  const lowercaseInput = input.toLowerCase();
  return ALL_EXPERTISE_TAGS.filter(tag => 
    lowercaseInput.includes(tag.toLowerCase())
  );
}
