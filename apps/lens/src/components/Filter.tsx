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
        orderBy: "fees24h" as const,
        fdv_usd: {
          min: undefined,
          max: undefined,
        },
        market_cap_usd: {
          max: undefined,
          min: undefined,
        },
        bin_step: {
          max: undefined,
          min: undefined,
        },
        base_fee: {
          max: undefined,
          min: undefined,
        },
      }}
      validationSchema={object({
        orderBy: string().oneOf([
          "fdv_usd",
          "market_cap_usd",
          "reserve_in_usd",
          "fees24h",
        ]),
        bin_step: object({
          min: number().optional(),
          max: number().optional(),
        }),
        base_fee: object({
          min: number().optional(),
          max: number().optional(),
        }),
        market_cap_usd: object({
          min: number().optional(),
          max: number().optional(),
        }),
        fdv_usd: object({
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
          <TVLFilter />
        </div>
        <FieldFilter />
        <FormikAutoSubmit />
      </Form>
    </Formik>
  );
}

function TVLFilter() {
  const { errors, touched } = useFormikContext<{
    market_cap_usd: { max: number; min: number };
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
            touched.market_cap_usd?.min &&
              errors.market_cap_usd?.min &&
              "error",
          )}
        />
        <Field
          name="liquidity.max"
          autoComplete="off"
          inputMode="decimal"
          placeholder="Max Liquidity"
          className={clsx(
            "md:min-w-32",
            touched.market_cap_usd?.max &&
              errors.market_cap_usd?.max &&
              "error",
          )}
        />
      </div>
    </div>
  );
}

function FieldFilter() {
  const [showGeneratePnLModal, setShowGeneratePnLModal] = useState(false);
  const { errors, touched } = useFormikContext<{
    fdv_usd: { min: number; max: number };
    bin_step: { min: number; max: number };
    base_fee: { min: number; max: number };
  }>();

  return (
    <>
      <div className="flex lt-md:flex-col lt-md:space-y-4 md:items-center">
        <div className="flex-1 flex flex-col space-y-2">
          <p>Pool Filter</p>
          <div className="flex flex-wrap gap-2 lt-md:grid lt-md:grid-cols-3 md:gap-x-4">
            <Field
              inputMode="decimal"
              name="bin_step.min"
              autoComplete="off"
              placeholder="Min Bin Step"
              className={clsx(
                "md:min-w-32",
                touched.bin_step?.min && errors.bin_step?.min && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="bin_step.max"
              autoComplete="off"
              placeholder="Max Bin Step"
              className={clsx(
                "md:min-w-32",
                touched.bin_step?.max && errors.bin_step?.max && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="base_fee.min"
              autoComplete="off"
              placeholder="Min Base Fee"
              className={clsx(
                "md:min-w-32",
                touched.base_fee?.min && errors.base_fee?.min && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="base_fee.max"
              autoComplete="off"
              placeholder="Max Base Fee"
              className={clsx(
                "md:min-w-32",
                touched.base_fee?.max && errors.base_fee?.max && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="fdv_usd.min"
              autoComplete="off"
              placeholder="Min FDV"
              className={clsx(
                "md:min-w-32",
                touched.fdv_usd?.min && errors.fdv_usd?.min && "error",
              )}
            />
            <Field
              inputMode="decimal"
              name="fdv_usd.max"
              autoComplete="off"
              placeholder="Max FDV"
              className={clsx(
                "md:min-w-32",
                touched.fdv_usd?.max && errors.fdv_usd?.max && "error",
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
