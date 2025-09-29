"use client";
import clsx from "clsx";
import debounce from "lodash.debounce";
import { useEffect, useMemo } from "react";
import { MdSearch } from "react-icons/md";

type SearchProps = {
  onSearchAction(value?: string): void;
};

export default function Search({
  onSearchAction,
  ...props
}: SearchProps & React.ComponentProps<"div">) {
  const onChange = useMemo(
    () =>
      debounce((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (value.trim().length > 0) onSearchAction(value);
        else onSearchAction(undefined);
      }, 500),
    [onSearchAction],
  );

  useEffect(() => {
    return () => onChange.cancel();
  }, [onChange]);

  return (
    <div
      {...props}
      className={clsx(
        "flex items-center space-x-2 border border-white/10 rounded-md px-2 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20 group",
        props.className,
      )}
    >
      <MdSearch
        size={24}
        className="text-white/50 group-focus-within:text-primary"
      />
      <input
        type="search"
        onChange={onChange}
        placeholder="Search for a pool with address and name"
        className="flex-1 py-2 bg-transparent placeholder-text-white/50 outline-none"
      />
    </div>
  );
}
