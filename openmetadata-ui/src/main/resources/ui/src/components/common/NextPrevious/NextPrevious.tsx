/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import Icon from '@ant-design/icons';
import { Button, Dropdown, InputNumber } from 'antd';
import classNames from 'classnames';
import { FC, FocusEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowRightOutlined } from '../../../assets/svg/arrow-right.svg';
import { ReactComponent as DownOutlined } from '../../../assets/svg/ic-arrow-down.svg';
import {
  ICON_DIMENSION,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { CursorType } from '../../../enums/pagination.enum';
import { computeTotalPages } from '../../../utils/PaginationUtils';
import { NextPreviousProps, PagingProps } from './NextPrevious.interface';

const NextPrevious: FC<NextPreviousProps> = ({
  className,
  paging,
  pagingHandler,
  pageSize,
  isNumberBased = false,
  currentPage = 1,
  isLoading,
  ...pagingProps
}: NextPreviousProps) => {
  const { t } = useTranslation();
  const {
    pageSizeOptions = [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
    onShowSizeChange,
  } = (pagingProps ?? {}) as PagingProps;

  const totalPages = useMemo(
    () => computeTotalPages(pageSize, paging?.total ?? 0),
    [pageSize, paging?.total]
  );

  const [inputPage, setInputPage] = useState<number | null>(currentPage);

  useEffect(() => {
    setInputPage(currentPage);
  }, [currentPage]);

  const onNextHandler = useCallback(() => {
    if (isNumberBased) {
      pagingHandler({ currentPage: currentPage + 1 });
    } else {
      pagingHandler({
        cursorType: CursorType.AFTER,
        currentPage: currentPage + 1,
      });
    }
  }, [isNumberBased, currentPage, pagingHandler]);

  const onPreviousHandler = useCallback(() => {
    if (isNumberBased) {
      pagingHandler({ currentPage: currentPage - 1 });
    } else {
      pagingHandler({
        cursorType: CursorType.BEFORE,
        currentPage: currentPage - 1,
      });
    }
  }, [isNumberBased, currentPage, pagingHandler]);

  const handlePageCommit = useCallback(
    (targetPage: number | string | null | undefined) => {
      const num =
        typeof targetPage === 'string'
          ? parseInt(targetPage, 10)
          : targetPage;

      if (num == null || isNaN(num)) {
        setInputPage(currentPage);

        return;
      }
      const maxPage = totalPages > 0 ? totalPages : 1;
      const sanitizedPage = Math.max(1, Math.min(num, maxPage));
      setInputPage(sanitizedPage);

      if (sanitizedPage !== currentPage) {
        if (isNumberBased) {
          pagingHandler({ currentPage: sanitizedPage });
        } else {
          const diff = sanitizedPage - currentPage;
          if (diff === 1) {
            onNextHandler();
          } else if (diff === -1) {
            onPreviousHandler();
          } else {
            pagingHandler({ currentPage: sanitizedPage });
          }
        }
      }
    },
    [currentPage, isNumberBased, onNextHandler, onPreviousHandler, pagingHandler, totalPages]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value;
      handlePageCommit(val ? parseInt(val, 10) : inputPage);
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    handlePageCommit(val ? parseInt(val, 10) : inputPage);
  };

  const computePrevDisableState = () => {
    if (isNumberBased) {
      return currentPage === 1;
    } else {
      return paging?.before ? false : true;
    }
  };

  const computeNextDisableState = () => {
    if (isNumberBased) {
      return currentPage === totalPages;
    } else {
      return paging?.after ? false : true;
    }
  };

  return (
    <div
      className={classNames(
        'pagination-container flex-center gap-3',
        className
      )}
      data-testid="pagination">
      <Button
        className="pagination-button hover-button"
        data-testid="previous"
        disabled={computePrevDisableState() || isLoading}
        icon={
          <Icon
            className="pagination-prev-icon"
            component={ArrowRightOutlined}
          />
        }
        type="text"
        onClick={onPreviousHandler}>
        <span>{t('label.previous')}</span>
      </Button>

      {totalPages > 1 ? (
        <span
          className="pagination-indicator d-inline-flex items-center gap-1"
          data-testid="page-indicator">
          <span>{t('label.page')}</span>
          <InputNumber
            aria-label={t('label.page')}
            className="pagination-page-input"
            controls={false}
            data-testid="page-number-input"
            disabled={isLoading}
            max={totalPages}
            min={1}
            size="small"
            value={inputPage}
            onBlur={handleBlur}
            onChange={(value) => setInputPage(value)}
            onKeyDown={handleKeyDown}
          />
          <span>{`${t('label.of')} ${totalPages}`}</span>
        </span>
      ) : (
        <span
          className="pagination-indicator"
          data-testid="page-indicator">{`${t('label.page')} ${currentPage} ${t(
          'label.of'
        )} ${totalPages || 1}`}</span>
      )}

      <Button
        className="pagination-button hover-button"
        data-testid="next"
        disabled={computeNextDisableState() || isLoading}
        type="text"
        onClick={onNextHandler}>
        <span> {t('label.next')}</span>
        <Icon className="pagination-next-icon" component={ArrowRightOutlined} />
      </Button>
      {onShowSizeChange && (
        <Dropdown
          disabled={isLoading}
          menu={{
            items: pageSizeOptions.map((size) => ({
              label: `${size} / ${t('label.page')}`,
              value: size,
              key: size,
              onClick: () => onShowSizeChange(size),
            })),
          }}>
          <Button
            className="pagination-button"
            data-testid="page-size-selection-dropdown"
            type="text"
            onClick={(e) => e.preventDefault()}>
            {`${pageSize} / ${t('label.page')}`}
            <Icon component={DownOutlined} style={ICON_DIMENSION} />
          </Button>
        </Dropdown>
      )}
    </div>
  );
};

export default NextPrevious;
