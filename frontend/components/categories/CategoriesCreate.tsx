// frontend/components/categories/CategoriesCreate.tsx
"use client";

import {
  useFormContext,
  useController,
  Controller,
  FieldValues,
} from "react-hook-form";
import { CategoryFormValues } from "../../app/categories/create/page";

type Category = {
  id: number;
  name: string;
  parent_id: number | null;
};

type CategoriesCreateProps = {
  categories: Category[];
};

const CategoriesCreate: React.FC<CategoriesCreateProps> = ({ categories }) => {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext<CategoryFormValues>();

  // 親カテゴリのみ抽出（大分類）
  const parentCategories = categories.filter(
    (category) => category.parent_id === null
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block font-medium">カテゴリ名 *</label>
        <input
          {...register("name")}
          type="text"
          className="w-full p-2 border rounded"
          placeholder="カテゴリ名を入力"
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block font-medium">親カテゴリ</label>
        <Controller
          name="parent_id"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              className="w-full p-2 border rounded"
              onChange={(e) => {
                const value = e.target.value;
                field.onChange(value === "" ? null : Number(value));
              }}
              value={field.value === null ? "" : field.value}
            >
              <option value="">親カテゴリを選択（大分類の場合は空）</option>
              {parentCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        />
        {errors.parent_id && (
          <p className="text-red-500 text-sm mt-1">
            {errors.parent_id.message}
          </p>
        )}
      </div>
    </div>
  );
};

export default CategoriesCreate;
