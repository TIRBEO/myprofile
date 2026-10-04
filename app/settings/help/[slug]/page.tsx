import { articleSlugs } from "@/lib/docs";
import ArticleScreen from "@/components/article-screen";

/* The articles are build-time content, not account data, so every one of them
   is written out at deploy instead of asking the edge for a function per
   article. `dynamicParams = false` is what actually makes it static — leave it
   on and Next keeps a server function behind the route for slugs it wasn't
   told about. An unknown slug is a 404, which is the honest answer. */
export const dynamicParams = false;

export function generateStaticParams() {
  return articleSlugs().map((slug) => ({ slug }));
}

export default function ArticlePage() {
  return <ArticleScreen />;
}