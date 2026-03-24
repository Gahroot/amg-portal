"use client";

import { useState, useMemo } from "react";
import {
  HelpCircle,
  Search,
  X,
  ExternalLink,
  MessageCircle,
  PlayCircle,
  FileText,
  ListChecks,
  ChevronRight,
  Mail,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useHelpContext } from "@/hooks/use-help-context";
import {
  getHelpContent,
  searchHelpContent,
  type HelpArticle,
  type PageHelpContent,
} from "./help-content";

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpPanel({ open, onOpenChange }: HelpPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const helpContext = useHelpContext();
  const helpContent = useMemo(
    () => getHelpContent(helpContext.pageType),
    [helpContext.pageType]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchHelpContent(searchQuery);
  }, [searchQuery]);

  const handleArticleClick = (article: HelpArticle) => {
    // For now, just log - in production this would open the article
    console.log("Opening article:", article.id);
    // If it's a video, could open a modal
    // If it's external, open in new tab
  };

  const handleContactSupport = () => {
    setShowContactForm(true);
  };

  const handleViewDocs = () => {
    if (helpContent.docsUrl) {
      window.open(helpContent.docsUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg"
        showCloseButton={false}
      >
        <SheetHeader className="space-y-0 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <SheetTitle className="text-lg">
                {helpContent.title} Help
              </SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <SheetDescription className="sr-only">
            Contextual help for the {helpContent.title} page
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSearchQuery("")}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-12rem)]">
          {showContactForm ? (
            <ContactSupportForm onBack={() => setShowContactForm(false)} />
          ) : searchQuery && searchResults.length > 0 ? (
            <SearchResults
              results={searchResults}
              onArticleClick={handleArticleClick}
            />
          ) : searchQuery && searchResults.length === 0 ? (
            <NoResults query={searchQuery} onContactSupport={handleContactSupport} />
          ) : (
            <HelpContentDisplay
              content={helpContent}
              onArticleClick={handleArticleClick}
            />
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleContactSupport}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Contact Support
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleViewDocs}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Full Docs
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface HelpContentDisplayProps {
  content: PageHelpContent;
  onArticleClick: (article: HelpArticle) => void;
}

function HelpContentDisplay({ content, onArticleClick }: HelpContentDisplayProps) {
  return (
    <div className="space-y-6 pb-20">
      {/* Page Overview */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Overview</h3>
        <p className="text-sm leading-relaxed">{content.overview}</p>
      </div>

      {/* Quick Tips */}
      {content.quickTips && content.quickTips.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Quick Tips
          </h3>
          <ul className="space-y-2">
            {content.quickTips.map((tip, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Separator />

      {/* Help Sections */}
      <Accordion type="multiple" defaultValue={[content.sections[0]?.title]} className="w-full">
        {content.sections.map((section) => (
          <AccordionItem key={section.title} value={section.title}>
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                {section.icon && <section.icon className="h-4 w-4" />}
                {section.title}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ArticleList articles={section.articles} onArticleClick={onArticleClick} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Related Articles */}
      {content.relatedArticles && content.relatedArticles.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Related Articles
            </h3>
            <ArticleList
              articles={content.relatedArticles}
              onArticleClick={onArticleClick}
            />
          </div>
        </>
      )}
    </div>
  );
}

interface ArticleListProps {
  articles: HelpArticle[];
  onArticleClick: (article: HelpArticle) => void;
}

function ArticleList({ articles, onArticleClick }: ArticleListProps) {
  return (
    <div className="space-y-1">
      {articles.map((article) => (
        <button
          key={article.id}
          onClick={() => onArticleClick(article)}
          className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm transition-colors hover:bg-accent"
        >
          <div className="flex items-center gap-3">
            <ArticleTypeIcon type={article.type} />
            <div>
              <div className="font-medium">{article.title}</div>
              {article.description && (
                <div className="text-xs text-muted-foreground">
                  {article.description}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {article.duration && (
              <Badge variant="secondary" className="text-xs">
                {article.duration}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}

function ArticleTypeIcon({ type }: { type: HelpArticle["type"] }) {
  const iconClass = "h-4 w-4 text-muted-foreground";
  switch (type) {
    case "video":
      return <PlayCircle className={iconClass} />;
    case "guide":
      return <ListChecks className={iconClass} />;
    case "faq":
      return <HelpCircle className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
}

interface SearchResultsProps {
  results: HelpArticle[];
  onArticleClick: (article: HelpArticle) => void;
}

function SearchResults({ results, onArticleClick }: SearchResultsProps) {
  return (
    <div className="space-y-4 pb-20">
      <p className="text-sm text-muted-foreground">
        Found {results.length} result{results.length !== 1 ? "s" : ""}
      </p>
      <ArticleList articles={results} onArticleClick={onArticleClick} />
    </div>
  );
}

interface NoResultsProps {
  query: string;
  onContactSupport: () => void;
}

function NoResults({ query, onContactSupport }: NoResultsProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
      <h3 className="mb-2 text-lg font-medium">No results found</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        No help articles match &quot;{query}&quot;
      </p>
      <Button variant="outline" size="sm" onClick={onContactSupport}>
        <MessageCircle className="mr-2 h-4 w-4" />
        Contact Support
      </Button>
    </div>
  );
}

interface ContactSupportFormProps {
  onBack: () => void;
}

function ContactSupportForm({ onBack }: ContactSupportFormProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-green-100 p-3 dark:bg-green-900">
          <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="mb-2 text-lg font-medium">Message Sent!</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Our support team will get back to you within 24 hours.
        </p>
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to Help
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-2"
      >
        <ChevronRight className="mr-1 h-4 w-4 rotate-180" />
        Back
      </Button>

      <div>
        <h3 className="text-lg font-medium">Contact Support</h3>
        <p className="text-sm text-muted-foreground">
          Can&apos;t find what you&apos;re looking for? Send us a message.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">
            Subject
          </label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of your issue"
            required
          />
        </div>
        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
            Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your question or issue in detail..."
            className="min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Sending..." : "Send Message"}
        </Button>
      </form>
    </div>
  );
}

/**
 * Help button component to be placed in headers
 */
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Open help panel"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
