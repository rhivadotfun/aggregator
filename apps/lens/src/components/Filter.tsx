"use client";
import type z from "zod";
import { clsx } from "clsx";
import { useState } from "react";
import { number, object, string } from "yup";
import { Field, Form, Formik, useFormikContext } from "formik";
import type { pairFilterSchema, pairOrderBySchema } from "@rhiva-ag/trpc";

import GeneratePnLModal from "./GeneratePnLModal";
import FormikAutoSubmit from "./FormikAutoSubmit";

type FilterProps = {
  onChangeAction: (
    filter: Partial<z.infer<typeof pairFilterSchema>>,
    orderBy: z.infer<typeof pairOrderBySchema>,
  ) => void;
};

export default function Filter({ onChangeAction }: FilterProps) {
  return (
    <Formik
      validateOnBlur
      validateOnChange
      initialValues={{
        orderBy: "H24SwapsVolumeUsd" as const,
        volume: {
          min: undefined,
          max: undefined,
        },
        liquidity: {
          max: undefined,
          min: undefined,
        },
        binStep: {
          max: undefined,
          min: undefined,
        },
        baseFee: {
          max: undefined,
          min: undefined,
        },
      }}
      validationSchema={object({
        orderBy: string().oneOf([
          "H24SwapsVolumeUsd",
          "M5SwapsFeeUsd",
          "H1SwapsFeeUsd",
          "h6SwapsFeeUsd",
          "H24SwapsFeeUsd",
          "totalFee",
          "baseFee",
          "dynamicFee",
          "protocolfee",
        ]),
        binStep: object({
          min: number().optional(),
          max: number().optional(),
        }),
        baseFee: object({
          min: number().optional(),
          max: number().optional(),
        }),
        liquidity: object({
          min: number().optional(),
          max: number().optional(),
        }),
        volume: object({
          min: number().optional(),
          max: number().optional(),
        }),
      })}
      onSubmit={(values) => {
        const filter: Partial<z.infer<typeof pairFilterSchema>> = {};

        for (const [key, value] of Object.entries(values)) {
          const clauses = [];
          if (typeof value === "object" && "min" in value && value.min)
            clauses.push({ gte: parseFloat(value.min) });
          if (typeof value === "object" && value.max)
            clauses.push({ lte: parseFloat(value.max) });
          if (clauses.length > 1)
            filter[key as keyof typeof filter] = { and: clauses };
          else if (clauses.length > 0) {
            const [clause] = clauses;
            filter[key as keyof typeof filter] = clause;
          }
        }

        onChangeAction(filter, [values.orderBy]);
      }}
    >
      <Form className="flex flex-col space-y-4">
        <div className="flex lt-md:flex-col lt-md:space-y-2 md:gap-x-8 md:gap-y-2 md:items-center md:flex-wrap">
          <Top100Filter />
          <SortByFilter />
          <TVLFilter />
        </div>
        <FieldFilter />
        <FormikAutoSubmit />
      </Form>
    </Formik>
  );
}

function Top100Filter() {
  const top100Labels = [
    { label: "Show All" },
    { label: "Fees>=1%" },
    { label: "Fees>=2%" },
    { label: "Fees>=5%" },
  ];
  return (
    <div className="flex flex-col space-y-2">
      <p>Top 100 Pools by Today's Fees</p>
      <div className="flex flex-wrap space-x-2 md:space-x-4 md:gap-y-2 md:flex-nowrap">
        {top100Labels.map(({ label }) => (
          <button
            key={label}
            type="button"
            className="flex-1  bg-gray/10 text-white/50 px-2 py-1 rounded-md lt-md:max-w-24 md:min-w-32"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortByFilter() {
  const feesLabels = [
    { label: "5M", value: "M5SwapsFeeUsd" },
    { label: "1H", value: "1HSwapsFeeUsd" },
    { label: "6H", value: "6HSwapsFeeUsd" },
    { label: "24H", value: "24HSwapsFeeUsd" },
  ];

  const { values, setFieldValue } = useFormikContext<{
    orderBy: (typeof feesLabels)[number]["value"];
  }>();

  return (
    <div className="flex flex-col space-y-2">
      <p>Sort By Fees</p>
      <div className="flex space-x-2 md:space-x-4 lt-md:flex-wrap md:gap-y-2">
        {feesLabels.map(({ label, value }) => {
          const selected = values.orderBy === value;

          return (
            <button
              key={label}
              type="button"
              className={clsx(
                "flex-1 px-2 py-1 rounded-md lt-md:max-w-24 md:min-w-32",
                selected ? "bg-primary text-black" : "bg-gray/10 text-white/50",
              )}
              onClick={() => {
                if (selected) setFieldValue("orderBy", "volume");
                else setFieldValue("orderBy", value);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TVLFilter() {
  const { errors, touched } = useFormikContext<{
    liquidity: { max: number; min: number };
  }>();

  return (
    <div className="flex flex-col space-y-2">
      <p>Filter by min to max TVL</p>
      <div className="flex gap-2 lt-md:grid lt-md:grid-cols-2 lt-md:flex-wrap md:gap-x-4">
        <Field
          name="liquidity.min"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Min Liquidity"
          className={clsx(
            "md:min-w-32",
            touched.liquidity?.min && errors.liquidity?.min && "error",
          )}
        />
        <Field
          name="liquidity.max"
          autoComplete="off"
          inputMode="decimal"
          placeholder="Max Liquidity"
          className={clsx(
            "md:min-w-32",
            touched.liquidity?.max && errors.liquidity?.max && "error",
          )}
        />
      </div>
    </div>
  );
}

function FieldFilter() {
  const [showGeneratePnLModal, setShowGeneratePnLModal] = useState(false);
  const { errors, touched } = useFormikContext<{
    tvl: { min: number; max: number };
    binStep: { min: number; max: number };
    baseFee: { min: number; max: number };
    liquidity: { min: number; max: number };
  }>();

  return (
    <>
      <div className="flex lt-md:flex-col lt-md:space-y-4 md:items-center">
        <div className="flex-1 flex flex-col space-y-2">
          <p>Pool Filter</p>
          <div className="flex flex-wrap gap-2 lt-md:grid lt-md:grid-cols-3 md:gap-x-4">
            <Field
              inputMode="decimal"
              name="binStep.min"
              autoComplete="off"
              placeholder="Min Bin Step"
              className={clsx(
                "md:min-w-32",
                touched.binStep?.min && errors.binStep?.min && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="binStep.max"
              autoComplete="off"
              placeholder="Max Bin Step"
              className={clsx(
                "md:min-w-32",
                touched.binStep?.max && errors.binStep?.max && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="baseFee.min"
              autoComplete="off"
              placeholder="Min Base Fee"
              className={clsx(
                "md:min-w-32",
                touched.baseFee?.min && errors.baseFee?.min && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="baseFee.max"
              autoComplete="off"
              placeholder="Max Base Fee"
              className={clsx(
                "md:min-w-32",
                touched.baseFee?.max && errors.baseFee?.max && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="volume.min"
              autoComplete="off"
              placeholder="Min Volume"
              className={clsx(
                "md:min-w-32",
                touched.tvl?.min && errors.tvl?.min && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="volume.max"
              autoComplete="off"
              placeholder="Max Volume"
              className={clsx(
                "md:min-w-32",
                touched.tvl?.max && errors.tvl?.max && "error",
              )}
            />
          </div>
        </div>
        <div className="flex gap-x-2 md:gap-x-4">
          <button
            type="button"
            onClick={() => setShowGeneratePnLModal(true)}
            className="flex-1 bg-primary text-black px-4 py-3 rounded-md text-nowrap"
          >
            Generate PnL
          </button>
          <div className="relative">
            <button
              type="button"
              className="flex-1 border border-primary text-primary px-4 py-3 rounded-md text-nowrap"
            >
              Track Positions
            </button>
            <div className="absolute -top-4 -right-4 bg-red-500 px-1.5 py-1 rounded-full">
              Coming Soon
            </div>
          </div>
        </div>
      </div>
      <GeneratePnLModal
        open={showGeneratePnLModal}
        onClose={() => setShowGeneratePnLModal(false)}
      />
    </>
  );
}
