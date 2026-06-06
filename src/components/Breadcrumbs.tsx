import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import React from "react";

type BreadcrumbItem = {
  label: string;
  params?: Record<string, string>;
  to: string;
};

type BreadcrumbsProps = {
  current: string;
  items: BreadcrumbItem[];
};

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ current, items }) => (
  <nav aria-label="Breadcrumb" className="overflow-x-auto">
    <ol className="flex min-w-max items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
      <li>
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-medium text-primary-700 transition-colors hover:text-primary-800"
        >
          <Home className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
      </li>
      {items.map((item) => (
        <React.Fragment key={`${item.to}-${item.label}`}>
          <li aria-hidden="true" className="text-gray-400">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li>
            <Link
              to={item.to as never}
              params={item.params as never}
              className="font-medium text-primary-700 transition-colors hover:text-primary-800"
            >
              {item.label}
            </Link>
          </li>
        </React.Fragment>
      ))}
      <li aria-hidden="true" className="text-gray-400">
        <ChevronRight className="h-4 w-4" />
      </li>
      <li aria-current="page" className="max-w-[16rem] truncate font-medium text-gray-900 dark:text-slate-100">
        {current}
      </li>
    </ol>
  </nav>
);

export default Breadcrumbs;
