"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localizeHref } from "@/lib/i18n/config";
import { useLocale } from "./LocaleProvider";

/** Lien interne du site, dans la langue de la page (/it/… en italien). */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  const h = typeof href === "string" ? localizeHref(href, locale) : href;
  return <NextLink href={h} {...rest} />;
}
