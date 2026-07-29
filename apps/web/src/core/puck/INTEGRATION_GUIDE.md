/**
 * Puck Editor Integration - Quick Start Guide
 * 
 * How to use and extend the Puck editor compliance system
 */

// ============================================================================
// BASIC USAGE
// ============================================================================

/**
 * 1. LOAD PUCK CONTENT
 * 
 * Every page starts by loading its Puck content structure
 */
import { usePuckContent } from '@/components/withPuckEditor';

function MyPage() {
  const puckContent = usePuckContent('pageName');
  // puckContent is a PageContent object with blocks array
}

// ============================================================================
// 2. RENDER PUCK CONTENT
// ============================================================================

/**
 * Use PuckPageRenderer to render Puck content
 * Inject live data to update specific blocks
 */
import { PuckPageRenderer } from '@/components/PuckPageRenderer';

function MyPage() {
  const puckContent = usePuckContent('dashboard');
  const liveData = fetchFromRepository();

  return (
    <PuckPageRenderer
      content={puckContent}
      dynamicData={{
        'block-id': { /* updated props */ }
      }}
    >
      {/* Optional: Custom React components for logic */}
    </PuckPageRenderer>
  );
}

// ============================================================================
// 3. ADD DYNAMIC DATA
// ============================================================================

/**
 * Map query results to block updates
 * Each block can receive dynamic data by ID
 */
const dynamicData = {
  'stats-1': {
    cards: [
      { label: 'Lists', value: count, icon: '📋' },
      // ...
    ]
  },
  'panel-1': {
    heading: `Welcome, ${userName}!`
  }
};

// ============================================================================
// 4. CREATE NEW EDITABLE COMPONENT
// ============================================================================

/**
 * Step 1: Define component in /core/puck/config.ts
 */
export const MyNewComponent = {
  render: (props: any) => (
    <div className="my-component">
      <h3>{props.title}</h3>
      <p>{props.description}</p>
    </div>
  ),
  fields: {
    title: { type: 'text', label: 'Title' },
    description: { type: 'textarea', label: 'Description' },
  },
  defaultProps: {
    title: 'Untitled',
    description: ''
  }
};

/**
 * Step 2: Register in puckConfig.components
 */
export const puckConfig = {
  components: {
    // ... existing
    MyNewComponent,  // Add here
  }
};

/**
 * Step 3: Use in page content
 */
export const defaultPageContents = {
  myPage: {
    blocks: [
      {
        id: 'component-1',
        type: 'myNewComponent',  // lowercase type name
        props: {
          title: 'My Title',
          description: 'My description'
        }
      }
    ]
  }
};

// ============================================================================
// 5. CONTENT MANAGEMENT
// ============================================================================

/**
 * Get page content
 */
import { getPageContent } from '@/infrastructure/puckContent';
const content = getPageContent('dashboard');

/**
 * Save changes
 */
import { savePageContent } from '@/infrastructure/puckContent';
savePageContent('dashboard', updatedContent);

/**
 * Export content (for version control)
 */
import { exportPageContent } from '@/infrastructure/puckContent';
const json = exportPageContent('dashboard');

/**
 * Import content (from backup)
 */
import { importPageContent } from '@/infrastructure/puckContent';
importPageContent('dashboard', jsonContent);

/**
 * Reset to defaults
 */
import { resetPageContent } from '@/infrastructure/puckContent';
resetPageContent('dashboard');

// ============================================================================
// 6. INJECT LIVE DATA INTO BLOCKS
// ============================================================================

/**
 * Pattern 1: Direct data injection
 */
<PuckPageRenderer
  content={puckContent}
  dynamicData={{
    'stats-1': { cards: liveStatData }
  }}
/>

/**
 * Pattern 2: Custom hook for data transformation
 */
function useBlockData(blockId: string, queryData: any) {
  return {
    cards: queryData?.stats.map(s => ({
      label: s.name,
      value: s.count
    }))
  };
}

// ============================================================================
// 7. CONDITIONAL RENDERING IN BLOCKS
// ============================================================================

/**
 * Component can accept conditional props
 */
export const ConditionalPanel = {
  render: (props: any) => (
    <section className={props.visible ? 'panel' : 'panel hidden'}>
      {props.children}
    </section>
  ),
  fields: {
    visible: { type: 'checkbox', label: 'Show this section' },
  }
};

/**
 * Control visibility from dynamic data
 */
<PuckPageRenderer
  content={puckContent}
  dynamicData={{
    'panel-1': { visible: isUserAdmin }
  }}
/>

// ============================================================================
// 8. EXTEND COMPONENT FIELDS
// ============================================================================

/**
 * Use different field types for rich editing
 */
fields: {
  text: { type: 'text', label: 'Short text' },
  description: { type: 'textarea', label: 'Long text' },
  color: { type: 'select', options: ['red', 'blue'], label: 'Color' },
  link: { type: 'text', label: 'URL' },
  number: { type: 'number', label: 'Count' },
  checkbox: { type: 'checkbox', label: 'Enabled' },
  array: {
    type: 'array',
    arrayFields: {
      name: { type: 'text' },
      value: { type: 'text' }
    }
  }
}

// ============================================================================
// 9. PUCK EDITOR INTEGRATION (FUTURE)
// ============================================================================

/**
 * When ready to add Puck editor UI:
 * 
 * 1. npm install @puckeditor/core @puckeditor/plugin-heading
 * 2. Create /app/editor/page.tsx
 * 3. Import Puck editor
 * 4. Pass puckConfig
 * 5. Load/save content via infrastructure
 */

// import { PuckEditor } from '@puckeditor/core';
// import { puckConfig } from '@/core/puck/config';

// export function EditorPage() {
//   const [data, setData] = useState(getPageContent('dashboard'));
//   return (
//     <PuckEditor
//       config={puckConfig}
//       data={data}
//       onChange={setData}
//       onPublish={(d) => savePageContent('dashboard', d)}
//     />
//   );
// }

// ============================================================================
// 10. BEST PRACTICES
// ============================================================================

/**
 * ✅ DO:
 * - Keep content in Puck
 * - Keep logic in React (queries, mutations)
 * - Use usePuckContent() to load content
 * - Inject live data via dynamicData prop
 * - Create reusable components
 * 
 * ❌ DON'T:
 * - Hardcode text in component render (move to Puck)
 * - Put query logic in Puck blocks
 * - Mix content and UI components
 * - Forget to register new components in puckConfig
 * - Store content in multiple places
 */

export default {};
