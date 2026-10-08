/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { SearchOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import { debounce } from 'lodash';
import {
  ChangeEvent,
  FC,
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface GovernanceListSearchInputProps {
  dataTestId: string;
  placeholder: string;
  onSearch: (value: string) => void;
  debounceMs?: number;
  value?: string;
  valueRef?: MutableRefObject<string>;
  width?: number;
}

/** Search field with consistent clear, debounce and Vietnamese IME behavior. */
const GovernanceListSearchInput: FC<GovernanceListSearchInputProps> = ({
  dataTestId,
  placeholder,
  onSearch,
  debounceMs = 400,
  value: controlledValue,
  valueRef,
  width = 300,
}) => {
  const [value, setValue] = useState(
    () => controlledValue ?? valueRef?.current ?? ''
  );
  const composing = useRef(false);
  const search = useRef(onSearch);
  search.current = onSearch;

  const debouncedSearch = useMemo(
    () => debounce((next: string) => search.current(next), debounceMs),
    [debounceMs]
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  useEffect(() => {
    if (controlledValue !== undefined) {
      setValue(controlledValue);
    }
  }, [controlledValue]);

  const submit = useCallback(
    (next: string) => {
      debouncedSearch.cancel();
      search.current(next);
    },
    [debouncedSearch]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setValue(next);
      if (valueRef) {
        valueRef.current = next;
      }
      if (!next) {
        submit(next);
      } else if (!composing.current) {
        debouncedSearch(next);
      }
    },
    [debouncedSearch, submit, valueRef]
  );

  return (
    <Input
      allowClear
      data-testid={dataTestId}
      placeholder={placeholder}
      prefix={<SearchOutlined className="text-grey-muted" />}
      style={{ width }}
      value={value}
      onChange={handleChange}
      onCompositionEnd={(event) => {
        composing.current = false;
        debouncedSearch(event.currentTarget.value);
      }}
      onCompositionStart={() => {
        composing.current = true;
        debouncedSearch.cancel();
      }}
      onPressEnter={(event) => {
        if (!composing.current) {
          submit(event.currentTarget.value);
        }
      }}
    />
  );
};

export default GovernanceListSearchInput;
