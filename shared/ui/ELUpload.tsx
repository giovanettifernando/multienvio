import { Upload } from 'antd';
import type { UploadProps, UploadFile } from 'antd';
import type { RcFile } from 'antd/es/upload';

/**
 * ELUpload - Design System v2
 * Wrapper para Upload do AntD
 */
export type ELUploadProps = UploadProps;
export type { UploadFile, RcFile };

export const ELUpload = Upload;
