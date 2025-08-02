const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class AIService {
  async generateTitle(text, type = 'text') {
    try {
      const prompt = `Generate a creative, engaging title for this ${type} memory. Keep it under 60 characters and make it personal and meaningful:

"${text.substring(0, 500)}"

Title:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a creative assistant that generates meaningful, personal titles for memories. Keep titles concise, emotional, and engaging.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 20,
        temperature: 0.7,
      });

      return response.choices[0].message.content
        .trim()
        .replace(/^["']|["']$/g, '');
    } catch (error) {
      console.error('AI Title Generation Error:', error);
      return null;
    }
  }

  async generateSummary(memories) {
    try {
      const memoryTexts = memories
        .map((m) => `${m.title || ''}: ${m.text || ''}`)
        .join('\n');

      const prompt = `Create a beautiful, nostalgic summary of these memories. Focus on the emotions, themes, and meaningful moments:

${memoryTexts.substring(0, 2000)}

Summary:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a thoughtful assistant that creates beautiful, emotional summaries of personal memories. Focus on themes, emotions, and meaningful connections.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.8,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('AI Summary Generation Error:', error);
      return null;
    }
  }

  async analyzeMood(text) {
    try {
      const prompt = `Analyze the emotional mood of this text and return a single emoji that best represents the overall feeling:

"${text.substring(0, 1000)}"

Emoji:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an emotion analysis assistant. Respond with only a single emoji that represents the dominant emotion in the text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 5,
        temperature: 0.3,
      });

      const emoji = response.choices[0].message.content.trim();
      return emoji.match(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      )
        ? emoji
        : '😊';
    } catch (error) {
      console.error('AI Mood Analysis Error:', error);
      return '😊';
    }
  }

  async enhanceText(text) {
    try {
      const prompt = `Enhance this personal memory text to be more vivid and engaging while keeping the original meaning and personal tone. Don't change the core message, just make it more descriptive and emotionally resonant:

"${text}"

Enhanced version:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a writing assistant that enhances personal memories. Make them more vivid and engaging while preserving the original voice and meaning.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: Math.min(text.length * 2, 500),
        temperature: 0.7,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('AI Text Enhancement Error:', error);
      return text;
    }
  }

  async generateTags(text, existingTags = []) {
    try {
      const prompt = `Generate 3-5 relevant tags for this memory. Focus on themes, emotions, activities, and locations. Return as comma-separated values:

"${text.substring(0, 1000)}"

Existing tags: ${existingTags.join(', ')}

Tags:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a tagging assistant. Generate relevant, concise tags for personal memories. Focus on emotions, activities, people, places, and themes.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 50,
        temperature: 0.5,
      });

      const tags = response.choices[0].message.content
        .trim()
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag && !existingTags.includes(tag))
        .slice(0, 5);

      return tags;
    } catch (error) {
      console.error('AI Tag Generation Error:', error);
      return [];
    }
  }

  async generateCapsuleInsights(capsule, memories) {
    try {
      const memoryCount = memories.length;
      const timeSpan = this.calculateTimeSpan(memories);
      const themes = this.extractThemes(memories);

      const prompt = `Generate insights for a memory capsule called "${
        capsule.title
      }" with ${memoryCount} memories spanning ${timeSpan}. Key themes: ${themes.join(
        ', '
      )}.

Create a warm, personal insight about this collection of memories:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an insightful assistant that creates meaningful observations about collections of personal memories.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.8,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('AI Insights Generation Error:', error);
      return null;
    }
  }

  calculateTimeSpan(memories) {
    if (memories.length === 0) return 'no time';

    const dates = memories.map((m) => new Date(m.createdAt)).sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];

    const diffTime = Math.abs(latest - earliest);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months`;
    return `${Math.ceil(diffDays / 365)} years`;
  }

  extractThemes(memories) {
    const allTags = memories.flatMap((m) => m.tags || []);
    const tagCounts = {};

    allTags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);
  }
}

module.exports = new AIService();
