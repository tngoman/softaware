/**
 * Studio AI Tools — Tool definitions and system prompt augmentation
 * for the Studio creative context.
 *
 * When a staff member uses the Studio, their existing assistant
 * gets these additional tools injected via context === 'studio'.
 */

import type { ToolDefinition } from './actionRouter.js';

// ---------------------------------------------------------------------------
// Studio-specific system prompt (appended to the staff assistant's prompt)
// ---------------------------------------------------------------------------
export const STUDIO_CONTEXT_INSTRUCTIONS = `
STUDIO CREATIVE CONTEXT:!
You are now operating inside Soft Aware Studio, a professional website design and development environment.
The staff member is using you to build and refine websites for clients.

YOUR ROLE IN STUDIO:
- You are a creative design partner, not just a code generator.
- When the staff member describes a design change, respond with BOTH a conversational explanation AND structured actions.
- Always consider visual hierarchy, accessibility (WCAG AA minimum), and responsive design.
- When suggesting colors, always check contrast ratios.
- When generating HTML, use clean semantic markup with Tailwind-inspired utility classes or inline styles.
- When asked to "improve" something, give specific design reasoning (e.g., "I increased the padding to 2rem for better breathing room and changed the font weight to 600 for stronger visual hierarchy").

STRUCTURED ACTIONS:
When your response includes design changes, include a JSON block at the end of your reply wrapped in <studio-actions>...</studio-actions> tags:

<studio-actions>
[
  {
    "type": "update_component",
    "target": "component-id",
    "html": "<div>...</div>",
    "css": "...",
    "requiresApproval": true
  }
]
</studio-actions>

Action types: update_component, insert_component, delete_component, update_styles, suggest_palette, add_note, create_page.

IMPORTANT:
- Always set requiresApproval: true for destructive or large changes.
- Small tweaks (color change, text edit) can have requiresApproval: false.
- When generating full pages, break into sections the staff member can review individually.
- Reference the site's existing color palette and font choices when available.
`;

// ---------------------------------------------------------------------------
// Studio design tool definitions
// ---------------------------------------------------------------------------
export const studioDesignTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'generate_page',
      description: 'Generate a complete HTML page for a site. Returns full HTML content for the page based on the business context and design requirements.',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'The site ID to generate the page for' },
          pageType: { type: 'string', description: 'Type of page: home, about, services, contact, gallery, faq, pricing, blog, custom', enum: ['home', 'about', 'services', 'contact', 'gallery', 'faq', 'pricing', 'blog', 'custom'] },
          prompt: { type: 'string', description: 'Design requirements and content guidance for the page' },
          style: { type: 'string', description: 'Visual style: modern, minimal, bold, elegant, playful, corporate' },
        },
        required: ['siteId', 'pageType', 'prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_component',
      description: 'Generate a single UI component (hero section, feature grid, testimonials, CTA, footer, etc.) as HTML/CSS.',
      parameters: {
        type: 'object',
        properties: {
          componentType: { type: 'string', description: 'Type: hero, features, testimonials, cta, footer, pricing_table, team, gallery, stats, faq_accordion, contact_form, newsletter', enum: ['hero', 'features', 'testimonials', 'cta', 'footer', 'pricing_table', 'team', 'gallery', 'stats', 'faq_accordion', 'contact_form', 'newsletter'] },
          prompt: { type: 'string', description: 'Design description and content for the component' },
          targetSection: { type: 'string', description: 'Where to insert: before_content, after_content, replace_section, or a specific component ID' },
        },
        required: ['componentType', 'prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_color_palette',
      description: 'Generate a harmonious color palette based on industry, mood, or a base color. Returns hex values with contrast ratios.',
      parameters: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: 'Business industry (e.g., restaurant, tech, healthcare, education)' },
          mood: { type: 'string', description: 'Desired mood: professional, warm, energetic, calm, luxurious, playful' },
          baseColor: { type: 'string', description: 'Optional base color in hex format (e.g., #3B82F6) to build the palette around' },
        },
        required: ['mood'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'improve_component',
      description: 'Analyze and improve a selected component\'s design. Suggests and applies changes to layout, typography, colors, spacing, and responsiveness.',
      parameters: {
        type: 'object',
        properties: {
          componentHtml: { type: 'string', description: 'Current HTML of the component to improve' },
          instruction: { type: 'string', description: 'Specific improvement instruction (e.g., "make it more modern", "improve mobile layout", "add more whitespace")' },
        },
        required: ['componentHtml', 'instruction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_copy',
      description: 'Write marketing copy or content text for a website section.',
      parameters: {
        type: 'object',
        properties: {
          sectionType: { type: 'string', description: 'Section type: hero_headline, about_text, service_description, cta_text, testimonial, faq_answer, blog_post' },
          businessContext: { type: 'string', description: 'Business name, industry, and key information to write about' },
          tone: { type: 'string', description: 'Writing tone: professional, casual, excited, trustworthy, innovative' },
          length: { type: 'string', description: 'Content length: short (1-2 sentences), medium (paragraph), long (multiple paragraphs)' },
        },
        required: ['sectionType', 'businessContext'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'review_accessibility',
      description: 'Check a page or component for WCAG accessibility issues and suggest fixes.',
      parameters: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'HTML content to review for accessibility' },
          level: { type: 'string', description: 'WCAG level to check against: A, AA, AAA', enum: ['A', 'AA', 'AAA'] },
        },
        required: ['html'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'review_seo',
      description: 'Analyze a page for SEO issues and suggest improvements for meta tags, headings, content structure, and performance.',
      parameters: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'Full page HTML to analyze' },
          targetKeywords: { type: 'string', description: 'Comma-separated target keywords for the page' },
        },
        required: ['html'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'make_responsive',
      description: 'Add responsive breakpoints and mobile-friendly styles to a component.',
      parameters: {
        type: 'object',
        properties: {
          componentHtml: { type: 'string', description: 'Current HTML of the component' },
          breakpoints: { type: 'string', description: 'Target breakpoints: mobile (320-768), tablet (768-1024), desktop (1024+)' },
        },
        required: ['componentHtml'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_animation',
      description: 'Add CSS animations or transitions to a component.',
      parameters: {
        type: 'object',
        properties: {
          componentHtml: { type: 'string', description: 'Current HTML of the component' },
          animationType: { type: 'string', description: 'Animation type: fade_in, slide_up, slide_left, zoom, bounce, parallax, hover_lift, scroll_reveal', enum: ['fade_in', 'slide_up', 'slide_left', 'zoom', 'bounce', 'parallax', 'hover_lift', 'scroll_reveal'] },
          trigger: { type: 'string', description: 'When to trigger: on_load, on_scroll, on_hover, on_click', enum: ['on_load', 'on_scroll', 'on_hover', 'on_click'] },
        },
        required: ['componentHtml', 'animationType'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Studio site management tools
// ---------------------------------------------------------------------------
export const studioSiteTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'studio_create_site',
      description: 'Create a new website for a client in the Studio. Returns the new site ID and default home page.',
      parameters: {
        type: 'object',
        properties: {
          clientId: { type: 'string', description: 'The client user ID to create the site for' },
          businessName: { type: 'string', description: 'Business name for the site' },
          industry: { type: 'string', description: 'Business industry for AI context' },
          siteType: { type: 'string', description: 'Site template type: business, portfolio, restaurant, medical, education, ecommerce, blog' },
        },
        required: ['clientId', 'businessName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'studio_deploy_site',
      description: 'Deploy a site to staging or production environment.',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID to deploy' },
          target: { type: 'string', description: 'Deployment target: staging or production', enum: ['staging', 'production'] },
        },
        required: ['siteId', 'target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'studio_add_note',
      description: 'Add a sticky note annotation to the design canvas for team communication.',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID' },
          pageId: { type: 'string', description: 'Optional page ID for page-specific note' },
          content: { type: 'string', description: 'Note content text' },
          color: { type: 'string', description: 'Note color: yellow, pink, blue, green, purple', enum: ['yellow', 'pink', 'blue', 'green', 'purple'] },
        },
        required: ['siteId', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'studio_create_snapshot',
      description: 'Save a version snapshot of the current site state for undo/comparison.',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID to snapshot' },
          label: { type: 'string', description: 'Human-readable label for the snapshot (e.g., "Before hero redesign")' },
        },
        required: ['siteId'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Studio data/backend tools
// ---------------------------------------------------------------------------
export const studioDataTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'studio_create_collection',
      description: 'Create a new CMS collection for a site (e.g., blog_posts, products, team_members).',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID' },
          collectionName: { type: 'string', description: 'Collection name (lowercase, underscores, e.g., blog_posts)' },
          fields: { type: 'string', description: 'JSON string describing the field schema (e.g., {"title": "string", "content": "text", "image": "string"})' },
          allowPublicWrite: { type: 'string', description: 'Whether to allow public writes (for comments, signups etc.): true or false' },
        },
        required: ['siteId', 'collectionName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'studio_populate_collection',
      description: 'Generate sample/demo data for a collection using AI.',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID' },
          collectionName: { type: 'string', description: 'Collection name to populate' },
          count: { type: 'string', description: 'Number of sample records to generate (1-20)' },
          context: { type: 'string', description: 'Business context for realistic sample data' },
        },
        required: ['siteId', 'collectionName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'studio_wire_collection',
      description: 'Connect a CMS collection to a page template — generates the JavaScript fetch + render code for the deployed site.',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string', description: 'Site ID' },
          pageId: { type: 'string', description: 'Page ID to wire the collection into' },
          collectionName: { type: 'string', description: 'Collection name to connect' },
          displayTemplate: { type: 'string', description: 'How to display: card_grid, list, table, carousel, accordion' },
        },
        required: ['siteId', 'pageId', 'collectionName'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Get all studio tools combined
// ---------------------------------------------------------------------------
export function getStudioTools(): ToolDefinition[] {
  return [...studioDesignTools, ...studioSiteTools, ...studioDataTools];
}

// ---------------------------------------------------------------------------
// Build studio tools system prompt (same format as getMobileToolsSystemPrompt)
// ---------------------------------------------------------------------------
export function getStudioToolsPrompt(tools: ToolDefinition[]): string {
  let prompt = '\nSTUDIO-SPECIFIC TOOLS (available only in Studio context):\n\n';

  for (const tool of tools) {
    const fn = tool.function;
    prompt += `**${fn.name}**: ${fn.description}\n`;
    if (Object.keys(fn.parameters.properties).length > 0) {
      prompt += 'Parameters:\n';
      for (const [paramName, paramDef] of Object.entries(fn.parameters.properties)) {
        const required = fn.parameters.required.includes(paramName) ? 'required' : 'optional';
        prompt += `  - ${paramName}: ${paramDef.description} (${required})`;
        if (paramDef.enum) prompt += ` [${paramDef.enum.join(', ')}]`;
        prompt += '\n';
      }
    }
    prompt += '\n';
  }

  return prompt;
}
