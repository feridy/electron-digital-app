// @ts-ignore
import { unreachable } from 'devlop';
import { toJsxRuntime, Components } from 'hast-util-to-jsx-runtime';
// import { Component } from 'hast-util-to-jsx-runtime/lib/components';
import { urlAttributes } from 'html-url-attributes';
import remarkParse from 'remark-parse';
import remarkRehype, { Options as RemarkRehypeOptions } from 'remark-rehype';
import { unified, PluggableList } from 'unified';
import { visit } from 'unist-util-visit';
import { VFile } from 'vfile';
import { Fragment, jsx } from 'vue/jsx-runtime';
import 'katex/dist/katex.min.css';
import RemarkMath from 'remark-math';
import RemarkBreaks from 'remark-breaks';
import RehypeKatex from 'rehype-katex';
import RemarkGfm from 'remark-gfm';
import RehypeHighlight from 'rehype-highlight';
import { defineComponent } from 'vue';

const emptyPlugins = [];

const emptyRemarkRehypeOptions = { allowDangerousHtml: true };
const safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i;

const deprecations = [
  { from: 'astPlugins', id: 'remove-buggy-html-in-markdown-parser' },
  { from: 'allowDangerousHtml', id: 'remove-buggy-html-in-markdown-parser' },
  {
    from: 'allowNode',
    id: 'replace-allownode-allowedtypes-and-disallowedtypes',
    to: 'allowElement'
  },
  {
    from: 'allowedTypes',
    id: 'replace-allownode-allowedtypes-and-disallowedtypes',
    to: 'allowedElements'
  },
  {
    from: 'disallowedTypes',
    id: 'replace-allownode-allowedtypes-and-disallowedtypes',
    to: 'disallowedElements'
  },
  { from: 'escapeHtml', id: 'remove-buggy-html-in-markdown-parser' },
  { from: 'includeElementIndex', id: '#remove-includeelementindex' },
  {
    from: 'includeNodeIndex',
    id: 'change-includenodeindex-to-includeelementindex'
  },
  { from: 'linkTarget', id: 'remove-linktarget' },
  { from: 'plugins', id: 'change-plugins-to-remarkplugins', to: 'remarkPlugins' },
  { from: 'rawSourcePos', id: '#remove-rawsourcepos' },
  { from: 'renderers', id: 'change-renderers-to-components', to: 'components' },
  { from: 'source', id: 'change-source-to-children', to: 'children' },
  { from: 'sourcePos', id: '#remove-sourcepos' },
  { from: 'transformImageUri', id: '#add-urltransform', to: 'urlTransform' },
  { from: 'transformLinkUri', id: '#add-urltransform', to: 'urlTransform' }
];

const changelog = 'https://github.com/remarkjs/react-markdown/blob/main/changelog.md';

const Markdown = (options: Options) => {
  const allowedElements = options.allowedElements;
  const allowElement = options.allowElement;
  const children = options.children || '';
  const className = options.className;
  const components = options.components;
  const disallowedElements = options.disallowedElements;
  const rehypePlugins = options.rehypePlugins || emptyPlugins;
  const remarkPlugins = options.remarkPlugins || emptyPlugins;
  const remarkRehypeOptions = options.remarkRehypeOptions
    ? { ...options.remarkRehypeOptions, ...emptyRemarkRehypeOptions }
    : emptyRemarkRehypeOptions;
  const skipHtml = options.skipHtml;
  const unwrapDisallowed = options.unwrapDisallowed;
  const urlTransform = options.urlTransform || defaultUrlTransform;

  const processor = unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, remarkRehypeOptions)
    .use(rehypePlugins);

  const file = new VFile();

  if (typeof children === 'string') {
    file.value = children;
  } else {
    unreachable('Unexpected value `' + children + '` for `children` prop, expected `string`');
  }

  if (allowedElements && disallowedElements) {
    unreachable(
      'Unexpected combined `allowedElements` and `disallowedElements`, expected one or the other'
    );
  }

  for (const deprecation of deprecations) {
    if (Object.hasOwn(options, deprecation.from)) {
      unreachable(
        'Unexpected `' +
          deprecation.from +
          '` prop, ' +
          (deprecation.to ? 'use `' + deprecation.to + '` instead' : 'remove it') +
          ' (see <' +
          changelog +
          '#' +
          deprecation.id +
          '> for more info)'
      );
    }
  }

  const mdastTree = processor.parse(file);

  let hastTree = processor.runSync(mdastTree, file);

  if (className) {
    hastTree = {
      //  @ts-ignore
      type: 'element',
      tagName: 'div',
      properties: { className },
      // Assume no doctypes.
      //  @ts-ignore
      children:
        /** @type {Array<ElementContent>} */ hastTree.type === 'root'
          ? hastTree.children
          : [hastTree]
    };
  }

  visit(hastTree, (node: any, index: any, parent: any): any => {
    if (node.type === 'raw' && parent && typeof index === 'number') {
      if (skipHtml) {
        parent.children.splice(index, 1);
      } else {
        parent.children[index] = { type: 'text', value: node.value };
      }

      return index;
    }

    if (node.type === 'element') {
      /** @type {string} */
      let key;

      for (key in urlAttributes) {
        if (Object.hasOwn(urlAttributes, key) && Object.hasOwn(node.properties, key)) {
          const value = node.properties[key];
          const test = urlAttributes[key];
          if (test === null || test.includes(node.tagName)) {
            // @ts-ignore
            node.properties[key] = urlTransform(String(value || ''), key, node);
          }
        }
      }
    }

    if (node.type === 'element') {
      let remove = allowedElements
        ? !allowedElements.includes(node.tagName)
        : disallowedElements
          ? disallowedElements.includes(node.tagName)
          : false;

      if (!remove && allowElement && typeof index === 'number') {
        remove = !allowElement(node, index, parent);
      }

      if (remove && parent && typeof index === 'number') {
        if (unwrapDisallowed && node.children) {
          parent.children.splice(index, 1, ...node.children);
        } else {
          parent.children.splice(index, 1);
        }

        return index;
      }
    }
  });

  return toJsxRuntime(hastTree, {
    Fragment,
    components,
    ignoreInvalidStyle: true,
    jsx,
    jsxs: jsx,
    elementAttributeNameCase: 'html',
    passKeys: true,
    passNode: true
  });
};

export function defaultUrlTransform(value: string) {
  // Same as:
  // <https://github.com/micromark/micromark/blob/929275e/packages/micromark-util-sanitize-uri/dev/index.js#L34>
  // But without the `encode` part.
  const colon = value.indexOf(':');
  const questionMark = value.indexOf('?');
  const numberSign = value.indexOf('#');
  const slash = value.indexOf('/');

  if (
    // If there is no protocol, it’s relative.
    colon < 0 ||
    // If the first colon is after a `?`, `#`, or `/`, it’s not a protocol.
    (slash > -1 && colon > slash) ||
    (questionMark > -1 && colon > questionMark) ||
    (numberSign > -1 && colon > numberSign) ||
    // It is a protocol, it should be allowed.
    safeProtocol.test(value.slice(0, colon))
  ) {
    return value;
  }

  return '';
}

export type Options = {
  /**
   * Filter elements (optional);
   * `allowedElements` / `disallowedElements` is used first.
   */
  allowElement?: any;
  /**
   * Tag names to allow (default: all tag names);
   * cannot combine w/ `disallowedElements`.
   */
  allowedElements?: ReadonlyArray<string> | null | undefined;
  /**
   * Markdown.
   */
  children?: string | null | undefined;
  /**
   * Wrap in a `div` with this class name.
   */
  className?: string | null | undefined;
  /**
   * Map tag names to components.
   */
  components?: Components | null | undefined;
  /**
   * Tag names to disallow (default: `[]`);
   * cannot combine w/ `allowedElements`.
   */
  disallowedElements?: ReadonlyArray<string> | null | undefined;
  /**
   * List of rehype plugins to use.
   */
  rehypePlugins?: PluggableList | null | undefined;
  /**
   * List of remark plugins to use.
   */
  remarkPlugins?: PluggableList | null | undefined;
  /**
   * Options to pass through to `remark-rehype`.
   */
  remarkRehypeOptions?: Readonly<RemarkRehypeOptions> | null | undefined;
  /**
   * Ignore HTML in markdown completely (default: `false`).
   */
  skipHtml?: boolean | null | undefined;
  /**
   * Extract (unwrap) what’s in disallowed elements (default: `false`);
   * normally when say `strong` is not allowed, it and it’s children are dropped,
   * with `unwrapDisallowed` the element itself is replaced by its children.
   */
  unwrapDisallowed?: boolean | null | undefined;
  /**
   * Change URLs (default: `defaultUrlTransform`)
   */
  urlTransform?:
    | ((url: string, key: string, node: Readonly<Element>) => string | null | undefined)
    | null
    | undefined;
};

function escapeBrackets(text: string) {
  const pattern = /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  return text.replace(pattern, (match, codeBlock, squareBracket, roundBracket) => {
    if (codeBlock) {
      return codeBlock;
    } else if (squareBracket) {
      return `$$${squareBracket}$$`;
    } else if (roundBracket) {
      return `$${roundBracket}$`;
    }
    return match;
  });
}

function escapeDollarNumber(text: string) {
  let escapedText = '';

  for (let i = 0; i < text.length; i += 1) {
    let char = text[i];
    const nextChar = text[i + 1] || ' ';

    if (char === '$' && nextChar >= '0' && nextChar <= '9') {
      char = '\\$';
    }

    escapedText += char;
  }

  return escapedText;
}

const MarkdownComponent = defineComponent({
  props: ['content'],
  setup: (props: MarkdownComponentProps) => {
    const escapedContent = escapeBrackets(escapeDollarNumber(props.content));

    return () => (
      <Markdown
        remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
        rehypePlugins={[
          RehypeKatex,
          [
            RehypeHighlight,
            {
              detect: false,
              ignoreMissing: true
            }
          ]
        ]}
        children={escapedContent}
      />
    );
  }
});

export type MarkdownComponentProps = {
  content: string;
};

export default MarkdownComponent;
